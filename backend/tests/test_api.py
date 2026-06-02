import io
import pytest
import pandas as pd
import numpy as np
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.auth import get_current_user
from backend.db.models import User


@pytest.fixture(autouse=True)
def override_auth():
    """Override auth dependency to return a mock user — no DB needed."""
    mock_user = User(id=1, email="test@example.com", hashed_password="mock")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def csv_bytes() -> bytes:
    rng = np.random.default_rng(1)
    df = pd.DataFrame({
        "date": pd.date_range("2020-01-01", periods=50, freq="ME").astype(str),
        "revenue": rng.normal(1000, 100, 50).round(2),
        "category": rng.choice(["A", "B", "C"], 50),
    })
    return df.to_csv(index=False).encode()


async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


async def test_upload_csv(csv_bytes):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/upload",
            files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        assert r.status_code == 200
        body = r.json()
        assert "session_id" in body
        assert body["rows"] == 50
        assert "revenue" in body["column_names"]


async def test_upload_invalid_type():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/upload",
            files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert r.status_code == 422


@pytest.mark.skip(reason="Requires actual server upload limits configured")
async def test_upload_too_large():
    big = b"a,b\n" + b"1,2\n" * 10_000_000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/upload",
            files={"file": ("big.csv", io.BytesIO(big), "text/csv")},
        )
        assert r.status_code in {200, 413}


@pytest.mark.skip(reason="Requires live database connection")
async def test_session_info(csv_bytes):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        upload = await c.post(
            "/upload",
            files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        session_id = upload.json()["session_id"]
        r = await c.get(f"/sessions/{session_id}")
        assert r.status_code == 200
        body = r.json()
        assert body["session_id"] == session_id
        assert "columns" in body


@pytest.mark.skip(reason="Requires live database")
async def test_session_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/sessions/does-not-exist")
        assert r.status_code == 404
