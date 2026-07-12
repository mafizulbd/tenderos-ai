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


def _signup(client, email: str) -> dict:
    resp = client.post("/auth/signup", json={"email": email, "password": "password123"})
    assert resp.status_code == 200
    headers = {"Authorization": f"Bearer {resp.json()['token']}"}
    org = client.get("/orgs/me", headers=headers).json()
    return {
        "headers": headers,
        "user_id": resp.json()["user"]["id"],
        "organization_id": org["id"],
        "email": email,
    }


@pytest.fixture
def org_owner(client):
    """A freshly signed-up user, alone in their own organization (owner role)."""
    return _signup(client, "owner@example.com")


@pytest.fixture
def org_with_member(client, org_owner):
    """org_owner plus a second user who has accepted an invite as 'member'."""
    invite = client.post(
        "/orgs/me/invites",
        json={"email": "member@example.com", "role": "member"},
        headers=org_owner["headers"],
    )
    assert invite.status_code == 200
    invite_token = invite.json()["token"]

    member = _signup(client, "member@example.com")
    accept = client.post(f"/invites/{invite_token}/accept", headers=member["headers"])
    assert accept.status_code == 200

    return {"owner": org_owner, "member": member, "organization_id": org_owner["organization_id"]}


@pytest.fixture
def second_org(client):
    """A fully separate user/organization, for cross-org isolation tests."""
    return _signup(client, "other-owner@example.com")
