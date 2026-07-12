import os

# Must be set before importing anything that touches database.py or main.py
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_tenderos.db")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ["TESTING"] = "1"  # disables rate-limit accumulation (unique key per request)

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
from main import app, ensure_schema


@pytest.fixture(autouse=True)
def fresh_db():
    """Drop and recreate all tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def registered(client):
    """Return auth headers for a freshly created test user."""
    resp = client.post(
        "/auth/signup",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}
