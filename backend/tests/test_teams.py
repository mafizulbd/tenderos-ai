import hashlib
import secrets
from datetime import datetime, timedelta
from unittest.mock import patch

from database import SessionLocal
from main import ensure_schema
from models import Organization, OrgMembership, Tender, User

from tests.test_tenders import MOCK_RESULT, _txt_file


def _hash(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
    return f"{salt}${digest.hex()}"


def test_backfill_regression_pre_phase2_user_keeps_working(client):
    """A user/tender inserted the way a pre-Phase-2 deployment would have them
    (no Organization/OrgMembership rows at all) must keep working unmodified
    once ensure_schema() runs again on Phase-2 code."""
    db = SessionLocal()
    try:
        user = User(
            email="legacy@example.com",
            password_hash=_hash("password123"),
            api_token="legacy-token",
            token_expires_at=datetime.utcnow() + timedelta(days=30),
            organization_name="Legacy Co",
            plan="free",
            monthly_tenders_used=1,
        )
        db.add(user)
        db.flush()
        tender = Tender(
            user_id=user.id,
            title="Legacy Tender",
            language="english",
            status="completed",
            summary="s",
        )
        db.add(tender)
        db.commit()
        tender_id = tender.id
    finally:
        db.close()

    # Simulate the app restarting on Phase-2 code.
    ensure_schema()

    headers = {"Authorization": "Bearer legacy-token"}
    listed = client.get("/tenders", headers=headers)
    assert listed.status_code == 200
    assert [t["id"] for t in listed.json()] == [tender_id]

    patched = client.patch(f"/tenders/{tender_id}", json={"notes": "still works"}, headers=headers)
    assert patched.status_code == 200
    assert patched.json()["notes"] == "still works"

    org = client.get("/orgs/me", headers=headers)
    assert org.status_code == 200
    assert org.json()["name"] == "Legacy Co"
    assert org.json()["role"] == "owner"


def test_backfill_idempotent(client, org_owner):
    db = SessionLocal()
    try:
        orgs_before = db.query(Organization).count()
        memberships_before = db.query(OrgMembership).count()
    finally:
        db.close()

    ensure_schema()
    ensure_schema()

    db = SessionLocal()
    try:
        assert db.query(Organization).count() == orgs_before
        assert db.query(OrgMembership).count() == memberships_before
    finally:
        db.close()


def test_invite_and_accept_flow(client, org_owner):
    invite = client.post(
        "/orgs/me/invites",
        json={"email": "newmember@example.com", "role": "member"},
        headers=org_owner["headers"],
    )
    assert invite.status_code == 200
    token = invite.json()["token"]

    signup = client.post("/auth/signup", json={"email": "newmember@example.com", "password": "password123"})
    member_headers = {"Authorization": f"Bearer {signup.json()['token']}"}

    accept = client.post(f"/invites/{token}/accept", headers=member_headers)
    assert accept.status_code == 200
    assert accept.json()["organization"]["id"] == org_owner["organization_id"]

    members = client.get("/orgs/me/members", headers=org_owner["headers"]).json()
    assert {"member@example.com", "newmember@example.com", "owner@example.com"} >= {m["email"] for m in members}
    roles = {m["email"]: m["role"] for m in members}
    assert roles["newmember@example.com"] == "member"


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_member_sees_org_tenders_but_cannot_modify_others(mock_analyze, client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]

    upload = client.post(
        "/tenders/analyze",
        data={"title": "Owner's tender", "language": "english"},
        files={"file": _txt_file()},
        headers=owner_headers,
    )
    assert upload.status_code == 200
    tender_id = upload.json()["id"]

    # Member can see it (org-wide visibility)...
    listed = client.get("/tenders", headers=member_headers)
    assert listed.status_code == 200
    assert tender_id in [t["id"] for t in listed.json()]

    # ...but cannot modify a tender they didn't create.
    patched = client.patch(f"/tenders/{tender_id}", json={"notes": "hijack"}, headers=member_headers)
    assert patched.status_code == 403

    deleted = client.delete(f"/tenders/{tender_id}", headers=member_headers)
    assert deleted.status_code == 403


def test_member_cannot_invite_or_change_roles(client, org_with_member):
    member_headers = org_with_member["member"]["headers"]
    member_user_id = org_with_member["member"]["user_id"]

    invite = client.post(
        "/orgs/me/invites",
        json={"email": "x@example.com", "role": "member"},
        headers=member_headers,
    )
    assert invite.status_code == 403

    role_change = client.patch(
        f"/orgs/me/members/{member_user_id}",
        json={"role": "admin"},
        headers=member_headers,
    )
    assert role_change.status_code == 403

    rename = client.put("/orgs/me", json={"name": "Hijacked"}, headers=member_headers)
    assert rename.status_code == 403


def test_sole_owner_cannot_be_demoted_or_removed(client, org_owner):
    owner_headers = org_owner["headers"]
    owner_user_id = org_owner["user_id"]

    demote = client.patch(
        f"/orgs/me/members/{owner_user_id}",
        json={"role": "member"},
        headers=owner_headers,
    )
    assert demote.status_code == 400

    remove = client.delete(f"/orgs/me/members/{owner_user_id}", headers=owner_headers)
    assert remove.status_code == 400


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_cross_org_isolation(mock_analyze, client, org_owner, second_org):
    upload = client.post(
        "/tenders/analyze",
        data={"title": "Org A tender", "language": "english"},
        files={"file": _txt_file()},
        headers=org_owner["headers"],
    )
    assert upload.status_code == 200
    tender_id = upload.json()["id"]

    other_headers = second_org["headers"]
    assert client.get(f"/tenders/{tender_id}", headers=other_headers).status_code == 404
    assert client.patch(f"/tenders/{tender_id}", json={"notes": "x"}, headers=other_headers).status_code == 404
    assert client.delete(f"/tenders/{tender_id}", headers=other_headers).status_code == 404

    listed = client.get("/tenders", headers=other_headers).json()
    assert tender_id not in [t["id"] for t in listed]
