from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, hash_password, verify_password, create_access_token
from ..db import get_db_dependency
from ..db.models import Session, User
from ..schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    SessionHistoryItem,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db_dependency)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    username = body.email.split("@")[0]
    user = User(email=body.email, username=username, hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return AuthResponse(access_token=token, user=user.to_dict())


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db_dependency)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.email)
    return AuthResponse(access_token=token, user=user.to_dict())


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.get("/sessions", response_model=list[SessionHistoryItem])
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dependency),
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id)
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()

    out = []
    for s in sessions:
        schema = s.schema or {}
        shape = schema.get("shape", [0, 0])
        out.append(
            SessionHistoryItem(
                session_id=s.session_id,
                filename=s.filename,
                shape=shape if isinstance(shape, list) else list(shape),
                created_at=s.created_at.isoformat() if s.created_at else None,
                expires_at=s.expires_at.isoformat() if s.expires_at else None,
            )
        )
    return out
