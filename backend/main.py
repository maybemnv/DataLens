from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_redis, init_db
from .logger import get_logger, log_request, setup_logging
from .routes.auth import router as auth_router
from .routes.chat import router as chat_router
from .routes.upload import router as upload_router
from .tasks.cleanup import cleanup_expired_sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger = get_logger(__name__)
    logger.info("=" * 50)
    logger.info("DataLens AI Backend Starting")
    logger.info(f"Version: {settings.model_name}")
    logger.info(f"Max upload size: {settings.max_upload_mb}MB")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info("=" * 50)

    await init_db()
    logger.info("Database initialized")


    try:
        deleted = await cleanup_expired_sessions()
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired sessions on startup")
    except Exception as e:
        logger.warning(f"Startup cleanup failed (non-fatal): {e}")

    yield

    await close_redis()
    logger.info("DataLens AI Backend Shutting Down")


app = FastAPI(
    title="DataLens AI",
    version="2.0.0",
    description="Autonomous Data Analysis Platform — FastAPI backend",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

logger = get_logger(__name__)

if settings.is_production():
    allowed_origins = settings.cors_origins
else:
    allowed_origins = settings.cors_origins + ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time

    start = time.perf_counter()
    response = await call_next(request)
    duration = (time.perf_counter() - start) * 1000
    log_request(request.method, request.url.path, response.status_code, duration)
    return response


app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(chat_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/")
async def root():
    return {
        "name": "DataLens AI API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth_register": "POST /auth/register",
            "auth_login": "POST /auth/login",
            "auth_me": "GET /auth/me",
            "auth_sessions": "GET /auth/sessions",
            "upload": "POST /upload",
            "session_info": "GET /sessions/{session_id}",
            "delete_session": "DELETE /sessions/{session_id}",
            "chat_http": "POST /chat/{session_id}",
            "chat_ws": "WS /ws/{session_id}",
            "health": "GET /health",
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
