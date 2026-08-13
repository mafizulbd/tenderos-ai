"""Tender-triggered Knowledge Base gap questions (/tenders/{id}/kb-gaps)."""

from unittest.mock import patch

from hermes_client import _parse_kb_gap_questions
from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="KB Gap Test Tender"):
    with patch("routers.tenders.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


def test_parse_kb_gap_questions_well_formed():
    raw = (
        "CATEGORY: certifications\n"
        "QUESTION: This tender requires ISO 9001:2015 — do you hold this certification?\n"
        "---\n"
        "CATEGORY: projects\n"
        "QUESTION: Do you have a completed water treatment project to reference?\n"
        "---\n"
    )
    parsed = _parse_kb_gap_questions(raw)
    assert parsed == [
        {"category": "certifications", "question": "This tender requires ISO 9001:2015 — do you hold this certification?"},
        {"category": "projects", "question": "Do you have a completed water treatment project to reference?"},
    ]


def test_parse_kb_gap_questions_empty_when_no_gaps():
    assert _parse_kb_gap_questions("") == []
    assert _parse_kb_gap_questions("No gaps identified.") == []


def test_parse_kb_gap_questions_unknown_category_falls_back_to_other():
    raw = "CATEGORY: pricing\nQUESTION: What is your target margin?\n---\n"
    parsed = _parse_kb_gap_questions(raw)
    assert parsed == [{"category": "other", "question": "What is your target margin?"}]


def test_kb_gaps_endpoint_persists_and_returns_questions(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])

    fake_questions = [
        {"category": "certifications", "question": "Do you hold ISO 9001:2015?"},
        {"category": "personnel", "question": "Who will be your site engineer for this project?"},
    ]
    with patch("routers.tenders.generate_kb_gap_questions", return_value=fake_questions) as mock_gen:
        r = client.post(f"/tenders/{tender_id}/kb-gaps", data={"language": "english"}, headers=org_owner["headers"])

    assert r.status_code == 200
    assert r.json()["kb_gap_questions"] == fake_questions
    mock_gen.assert_called_once()

    # Persisted on the tender, and returned by the detail endpoint too.
    detail = client.get(f"/tenders/{tender_id}", headers=org_owner["headers"])
    assert detail.json()["kb_gap_questions"] == fake_questions


def test_kb_gaps_requires_tender_ownership(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tender_id = _create_tender(client, owner_headers)

    with patch("routers.tenders.generate_kb_gap_questions", return_value=[]):
        r = client.post(f"/tenders/{tender_id}/kb-gaps", data={"language": "english"}, headers=member_headers)
    assert r.status_code == 403


def test_kb_gaps_cross_org_isolation(client, org_owner, second_org):
    tender_id = _create_tender(client, org_owner["headers"])
    with patch("routers.tenders.generate_kb_gap_questions", return_value=[]):
        r = client.post(f"/tenders/{tender_id}/kb-gaps", data={"language": "english"}, headers=second_org["headers"])
    assert r.status_code == 404
