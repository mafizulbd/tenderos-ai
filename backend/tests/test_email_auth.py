from datetime import datetime, timedelta

from database import SessionLocal
from models import User


def _get_user(email: str) -> User:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()


def test_signup_creates_unverified_user_with_token(client):
    r = client.post("/auth/signup", json={"email": "new@test.com", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["user"]["email_verified"] is False

    user = _get_user("new@test.com")
    assert user.email_verified is False
    assert user.email_verification_token
    assert user.email_verification_expires_at > datetime.utcnow()


def test_verify_email_success(client):
    client.post("/auth/signup", json={"email": "verify@test.com", "password": "password123"})
    token = _get_user("verify@test.com").email_verification_token

    r = client.post("/auth/verify-email", json={"token": token})
    assert r.status_code == 200

    user = _get_user("verify@test.com")
    assert user.email_verified is True
    assert user.email_verification_token is None

    me = client.get("/me", headers={"Authorization": f"Bearer {user.api_token}"})
    assert me.json()["email_verified"] is True


def test_verify_email_invalid_token(client):
    r = client.post("/auth/verify-email", json={"token": "not-a-real-token"})
    assert r.status_code == 400


def test_verify_email_expired_token(client):
    client.post("/auth/signup", json={"email": "expired@test.com", "password": "password123"})
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "expired@test.com").first()
        user.email_verification_expires_at = datetime.utcnow() - timedelta(hours=1)
        token = user.email_verification_token
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/verify-email", json={"token": token})
    assert r.status_code == 400
    assert "expired" in r.json()["detail"].lower()


def test_resend_verification(client, registered):
    r = client.post("/auth/resend-verification", headers=registered)
    assert r.status_code == 200
    assert r.json()["detail"] == "Verification email sent."


def test_resend_verification_already_verified(client, registered):
    user = _get_user("test@example.com")
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == user.id).first()
        u.email_verified = True
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/resend-verification", headers=registered)
    assert r.status_code == 200
    assert r.json()["detail"] == "Email already verified."


def test_forgot_password_existing_and_nonexistent_email_return_same_response(client):
    client.post("/auth/signup", json={"email": "forgot@test.com", "password": "password123"})

    r1 = client.post("/auth/forgot-password", json={"email": "forgot@test.com"})
    r2 = client.post("/auth/forgot-password", json={"email": "doesnotexist@test.com"})

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()

    user = _get_user("forgot@test.com")
    assert user.password_reset_token
    assert user.password_reset_expires_at > datetime.utcnow()


def test_reset_password_success(client):
    client.post("/auth/signup", json={"email": "reset@test.com", "password": "oldpassword123"})
    client.post("/auth/forgot-password", json={"email": "reset@test.com"})
    user_before = _get_user("reset@test.com")
    old_api_token = user_before.api_token
    token = user_before.password_reset_token

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "newpassword123"})
    assert r.status_code == 200

    user_after = _get_user("reset@test.com")
    assert user_after.password_reset_token is None
    assert user_after.api_token != old_api_token  # session rotated

    # Old password no longer works, new one does.
    assert client.post(
        "/auth/login", json={"email": "reset@test.com", "password": "oldpassword123"}
    ).status_code == 401
    login = client.post("/auth/login", json={"email": "reset@test.com", "password": "newpassword123"})
    assert login.status_code == 200


def test_reset_password_invalid_token(client):
    r = client.post("/auth/reset-password", json={"token": "bogus", "new_password": "newpassword123"})
    assert r.status_code == 400


def test_reset_password_expired_token(client):
    client.post("/auth/signup", json={"email": "expiredreset@test.com", "password": "password123"})
    client.post("/auth/forgot-password", json={"email": "expiredreset@test.com"})
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "expiredreset@test.com").first()
        user.password_reset_expires_at = datetime.utcnow() - timedelta(hours=1)
        token = user.password_reset_token
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "newpassword123"})
    assert r.status_code == 400
    assert "expired" in r.json()["detail"].lower()


def test_reset_password_too_short(client):
    client.post("/auth/signup", json={"email": "shortreset@test.com", "password": "password123"})
    client.post("/auth/forgot-password", json={"email": "shortreset@test.com"})
    token = _get_user("shortreset@test.com").password_reset_token

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "short"})
    assert r.status_code == 400
