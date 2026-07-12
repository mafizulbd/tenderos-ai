import io
from unittest.mock import patch

MOCK_RESULT = {
    "summary": "Test executive summary content.",
    "eligibility": "Test eligibility criteria.",
    "financial_requirements": "Bid security: ৳50,000. Turnover: ৳1 crore.",
    "required_documents": "Trade License, TIN Certificate, Bank Solvency.",
    "compliance_matrix": "Req | Clause | COMPLIANT | Action",
    "risk_analysis": "LOW risk. Mitigation: standard procedures.",
    "bid_recommendation": "BID SCORE: 75\nBID DECISION: RECOMMENDED\n\nStrong fit for the requirement.",
    "proposal_draft": "Test proposal draft cover letter.",
    "final_checklist": "- Submit bid security\n- Attend bid opening",
}


def _txt_file(content: str = "Sample tender document with enough text for analysis purposes."):
    return ("test.txt", io.BytesIO(content.encode()), "text/plain")


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_analyze_tender(mock_analyze, client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "Test Tender", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Test Tender"
    assert data["language"] == "english"
    assert data["status"] == "completed"
    assert "Test executive summary" in data["summary"]
    assert data["bid_score"] == 75
    assert data["financial_requirements"] is not None


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_analyze_bangla(mock_analyze, client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "Bangla Tender", "language": "bangla"},
        files={"file": _txt_file()},
        headers=registered,
    )
    assert r.status_code == 200
    assert r.json()["language"] == "bangla"


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_analyze_with_deadline(mock_analyze, client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "Deadline Tender", "language": "english", "deadline": "2026-12-31"},
        files={"file": _txt_file()},
        headers=registered,
    )
    assert r.status_code == 200
    assert r.json()["deadline"] is not None


def test_analyze_no_title(client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "  ", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    )
    assert r.status_code == 400


def test_analyze_bad_language(client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "T", "language": "french"},
        files={"file": _txt_file()},
        headers=registered,
    )
    assert r.status_code == 400


def test_analyze_too_short_text(client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "T", "language": "english"},
        files={"file": ("t.txt", io.BytesIO(b"short"), "text/plain")},
        headers=registered,
    )
    assert r.status_code == 400


def test_analyze_unsupported_type(client, registered):
    r = client.post(
        "/tenders/analyze",
        data={"title": "T", "language": "english"},
        files={"file": ("t.xlsx", io.BytesIO(b"x" * 100), "application/vnd.ms-excel")},
        headers=registered,
    )
    assert r.status_code == 400


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_list_tenders(mock_analyze, client, registered):
    client.post(
        "/tenders/analyze",
        data={"title": "T1", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    )

    r = client.get("/tenders", headers=registered)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 1
    assert items[0]["title"] == "T1"
    assert "bid_status" in items[0]
    assert "bid_score" in items[0]


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_list_tenders_search(mock_analyze, client, registered):
    for title in ("Alpha Tender", "Beta Tender"):
        client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=registered,
        )

    r = client.get("/tenders?search=Alpha", headers=registered)
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["title"] == "Alpha Tender"


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_get_tender(mock_analyze, client, registered):
    tender_id = client.post(
        "/tenders/analyze",
        data={"title": "T", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    ).json()["id"]

    r = client.get(f"/tenders/{tender_id}", headers=registered)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == tender_id
    assert "financial_requirements" in data
    assert "bid_recommendation" in data


def test_get_tender_not_found(client, registered):
    r = client.get("/tenders/9999", headers=registered)
    assert r.status_code == 404


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_update_tender(mock_analyze, client, registered):
    tender_id = client.post(
        "/tenders/analyze",
        data={"title": "Patchable", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    ).json()["id"]

    r = client.patch(
        f"/tenders/{tender_id}",
        json={"bid_status": "submitted", "notes": "Submitted on time."},
        headers=registered,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["bid_status"] == "submitted"
    assert data["notes"] == "Submitted on time."


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_delete_tender(mock_analyze, client, registered):
    tender_id = client.post(
        "/tenders/analyze",
        data={"title": "ToDelete", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    ).json()["id"]

    r = client.delete(f"/tenders/{tender_id}", headers=registered)
    assert r.status_code == 200

    r = client.get(f"/tenders/{tender_id}", headers=registered)
    assert r.status_code == 404


def test_delete_tender_not_found(client, registered):
    r = client.delete("/tenders/9999", headers=registered)
    assert r.status_code == 404


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_reanalyze_tender(mock_analyze, client, registered):
    tender_id = client.post(
        "/tenders/analyze",
        data={"title": "ReA", "language": "english"},
        files={"file": _txt_file()},
        headers=registered,
    ).json()["id"]

    r = client.post(
        f"/tenders/{tender_id}/reanalyze",
        json={"language": "bangla"},
        headers=registered,
    )
    assert r.status_code == 200
    assert r.json()["language"] == "bangla"
    assert r.json()["bid_score"] == 75


def test_reanalyze_bad_language(client, registered):
    from database import SessionLocal
    from models import Tender

    db = SessionLocal()
    tender = Tender(
        user_id=1,
        organization_id=1,
        title="T",
        language="english",
        status="completed",
        original_text="A" * 50,
        summary="s",
        eligibility="e",
        required_documents="r",
        compliance_matrix="c",
        risk_analysis="ri",
        proposal_draft="p",
        final_checklist="f",
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)
    tid = tender.id
    db.close()

    r = client.post(
        f"/tenders/{tid}/reanalyze",
        json={"language": "spanish"},
        headers=registered,
    )
    assert r.status_code == 400


def test_subscription(client, registered):
    r = client.get("/subscription", headers=registered)
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "free"
    assert data["monthly_limit"] == 5
    assert data["monthly_tenders_used"] == 0
    assert data["is_unlimited"] is False


@patch("main.analyze_with_gemini", return_value=MOCK_RESULT)
def test_tenders_isolated_per_user(mock_analyze, client):
    """Users cannot see each other's tenders."""
    for email, title in [("a@test.com", "A's Tender"), ("b@test.com", "B's Tender")]:
        signup_r = client.post(
            "/auth/signup", json={"email": email, "password": "password123"}
        )
        tok = signup_r.json()["token"]
        client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers={"Authorization": f"Bearer {tok}"},
        )

    tok_a = client.post(
        "/auth/login", json={"email": "a@test.com", "password": "password123"}
    ).json()["token"]

    items = client.get("/tenders", headers={"Authorization": f"Bearer {tok_a}"}).json()
    assert len(items) == 1
    assert items[0]["title"] == "A's Tender"
