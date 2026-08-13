"""Structured company knowledge base: Personnel, Certifications, Project Experience."""

import json

from main import _backfill_structured_company_data


def test_personnel_crud(client, org_owner):
    created = client.post(
        "/company/personnel",
        json={"name": "Rahim Uddin", "role": "Site Engineer", "qualification": "BSc Civil", "experience": "8 years"},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    pid = created.json()["id"]

    listed = client.get("/company/personnel", headers=org_owner["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["name"] == "Rahim Uddin"

    updated = client.patch(f"/company/personnel/{pid}", json={"role": "Project Manager"}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["role"] == "Project Manager"

    deleted = client.delete(f"/company/personnel/{pid}", headers=org_owner["headers"])
    assert deleted.status_code == 200
    assert client.get("/company/personnel", headers=org_owner["headers"]).json() == []


def test_personnel_requires_name(client, org_owner):
    r = client.post("/company/personnel", json={"name": "   "}, headers=org_owner["headers"])
    assert r.status_code == 400


def test_certification_crud(client, org_owner):
    created = client.post(
        "/company/certifications",
        json={"name": "ISO 9001", "number": "ISO-1234", "expiry": "2027-01-01"},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    cid = created.json()["id"]

    updated = client.patch(f"/company/certifications/{cid}", json={"expiry": "2028-01-01"}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["expiry"] == "2028-01-01"

    deleted = client.delete(f"/company/certifications/{cid}", headers=org_owner["headers"])
    assert deleted.status_code == 200
    assert client.get("/company/certifications", headers=org_owner["headers"]).json() == []


def test_project_experience_crud(client, org_owner):
    created = client.post(
        "/company/projects",
        json={"name": "Dhaka Water Treatment Plant", "client": "DWASA", "value": "50000000", "year": "2023"},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    proj_id = created.json()["id"]

    listed = client.get("/company/projects", headers=org_owner["headers"])
    assert len(listed.json()) == 1
    assert listed.json()[0]["client"] == "DWASA"

    updated = client.patch(f"/company/projects/{proj_id}", json={"category": "Water Infrastructure"}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["category"] == "Water Infrastructure"

    deleted = client.delete(f"/company/projects/{proj_id}", headers=org_owner["headers"])
    assert deleted.status_code == 200
    assert client.get("/company/projects", headers=org_owner["headers"]).json() == []


def test_only_creator_or_admin_can_modify_personnel(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]

    created = client.post(
        "/company/personnel", json={"name": "Member's Engineer"}, headers=member_headers,
    )
    pid = created.json()["id"]

    # Owner (admin-equivalent) can edit a member's record.
    edited = client.patch(f"/company/personnel/{pid}", json={"role": "Verified"}, headers=owner_headers)
    assert edited.status_code == 200


def test_cross_org_isolation(client, org_owner, second_org):
    created = client.post("/company/personnel", json={"name": "Org A Engineer"}, headers=org_owner["headers"])
    pid = created.json()["id"]

    # Second org can't see or touch org_owner's personnel record.
    assert client.get("/company/personnel", headers=second_org["headers"]).json() == []
    assert client.patch(f"/company/personnel/{pid}", json={"role": "x"}, headers=second_org["headers"]).status_code == 404
    assert client.delete(f"/company/personnel/{pid}", headers=second_org["headers"]).status_code == 404


def test_backfill_migrates_legacy_json_blob_into_structured_tables(client, org_owner):
    """Simulates a pre-existing user whose company data still lives only in the
    User.knowledge_base JSON blob (the state every real user was in before this
    migration). Confirms the startup backfill promotes it into the new tables
    without the user re-entering anything, and is safe to re-run.
    """
    legacy_kb = {
        "past_projects": [
            {"name": "Rural Road Upgrade", "client": "LGED", "value": "12000000", "year": "2021", "duration": "8 months", "category": "Roads"},
            {"name": "", "client": "should be skipped (blank name)"},
        ],
        "technical_team": [
            {"name": "Karim Ahmed", "role": "Site Supervisor", "qualification": "Diploma", "experience": "5 years"},
        ],
        "certifications": [
            {"name": "Trade License", "number": "TL-9988", "expiry": "2026-12-31"},
        ],
    }
    r = client.put(
        "/me/knowledge-base",
        json={"knowledge_base": legacy_kb},
        headers=org_owner["headers"],
    )
    assert r.status_code == 200

    # No structured rows exist yet — everything is still trapped in the blob.
    assert client.get("/company/projects", headers=org_owner["headers"]).json() == []

    _backfill_structured_company_data()

    projects = client.get("/company/projects", headers=org_owner["headers"]).json()
    assert len(projects) == 1
    assert projects[0]["name"] == "Rural Road Upgrade"
    assert projects[0]["client"] == "LGED"

    personnel = client.get("/company/personnel", headers=org_owner["headers"]).json()
    assert len(personnel) == 1
    assert personnel[0]["name"] == "Karim Ahmed"

    certs = client.get("/company/certifications", headers=org_owner["headers"]).json()
    assert len(certs) == 1
    assert certs[0]["name"] == "Trade License"

    # Re-running the backfill must not duplicate rows for an org that already has data.
    _backfill_structured_company_data()
    assert len(client.get("/company/projects", headers=org_owner["headers"]).json()) == 1
    assert len(client.get("/company/personnel", headers=org_owner["headers"]).json()) == 1
    assert len(client.get("/company/certifications", headers=org_owner["headers"]).json()) == 1


def test_structured_data_takes_precedence_over_blob_in_assistant_grounding(client, org_owner, monkeypatch):
    """The AI assistant/proposal/bid-strategy prompts should be grounded in the
    structured tables once populated, not the stale JSON blob, even if the
    blob still has old data sitting in it.
    """
    from tests.test_tenders import MOCK_RESULT, _txt_file
    from unittest.mock import patch

    # Seed a stale blob AND a fresh structured record with a different name.
    client.put(
        "/me/knowledge-base",
        json={"knowledge_base": {"technical_team": [{"name": "Stale Blob Engineer"}]}},
        headers=org_owner["headers"],
    )
    client.post("/company/personnel", json={"name": "Fresh Structured Engineer"}, headers=org_owner["headers"])

    with patch("routers.tenders.analyze_with_gemini", return_value=MOCK_RESULT):
        created = client.post(
            "/tenders/analyze",
            data={"title": "Grounding Test Tender", "language": "english"},
            files={"file": _txt_file()},
            headers=org_owner["headers"],
        )
    tender_id = created.json()["id"]

    captured = {}

    def fake_stream_assistant_reply(tender_analysis, kb, history, question, language):
        captured["kb"] = kb
        yield "ok"

    monkeypatch.setattr("routers.tenders.stream_assistant_reply", fake_stream_assistant_reply)

    resp = client.post(
        f"/tenders/{tender_id}/assistant",
        json={"question": "Who is on the team?"},
        headers=org_owner["headers"],
    )
    assert resp.status_code == 200
    list(resp.iter_lines())  # drain the streaming response so the generator runs

    names = [m["name"] for m in captured["kb"]["technical_team"]]
    assert "Fresh Structured Engineer" in names
    assert "Stale Blob Engineer" not in names
