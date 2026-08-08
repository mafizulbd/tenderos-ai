"""AI Procurement Assistant (POST /tenders/{id}/assistant) — grounded per-tender Q&A.

stream_assistant_reply is mocked throughout; a real Gemini call is verified
separately and manually, not in the automated suite.
"""

from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="Assistant Test Tender"):
    with patch("routers.tenders.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


def _parse_sse(body: str) -> list[dict]:
    import json
    events = []
    for line in body.split("\n"):
        if line.startswith("data: "):
            events.append(json.loads(line[len("data: "):]))
    return events


def test_assistant_answers_grounded_question(client, org_owner):
    headers = org_owner["headers"]
    tid = _create_tender(client, headers)

    def fake_stream(tender_analysis, kb, history, question, language):
        assert "Test eligibility criteria." in tender_analysis["eligibility"]
        # The structured analysis is a summary and can omit clauses (e.g. penalties)
        # that are still in the raw document, so the assistant must see both.
        assert "Sample tender document" in tender_analysis["original_text"]
        yield "Based on the eligibility criteria, "
        yield "yes, this looks like a fit."

    with patch("routers.tenders.stream_assistant_reply", side_effect=fake_stream):
        r = client.post(
            f"/tenders/{tid}/assistant",
            json={"question": "Am I eligible for this tender?", "history": []},
            headers=headers,
        )

    assert r.status_code == 200
    events = _parse_sse(r.text)
    chunks = [e["text"] for e in events if e["type"] == "chunk"]
    assert "".join(chunks) == "Based on the eligibility criteria, yes, this looks like a fit."
    assert events[-1]["type"] == "done"


def test_assistant_passes_conversation_history(client, org_owner):
    headers = org_owner["headers"]
    tid = _create_tender(client, headers)

    captured = {}

    def fake_stream(tender_analysis, kb, history, question, language):
        captured["history"] = history
        captured["question"] = question
        yield "ok"

    history = [
        {"role": "user", "content": "What documents are missing?"},
        {"role": "assistant", "content": "You are missing the trade license."},
    ]
    with patch("routers.tenders.stream_assistant_reply", side_effect=fake_stream):
        r = client.post(
            f"/tenders/{tid}/assistant",
            json={"question": "Anything else?", "history": history},
            headers=headers,
        )

    assert r.status_code == 200
    assert captured["question"] == "Anything else?"
    assert captured["history"] == history


def test_assistant_rejects_empty_question(client, org_owner):
    headers = org_owner["headers"]
    tid = _create_tender(client, headers)

    r = client.post(f"/tenders/{tid}/assistant", json={"question": "   "}, headers=headers)
    assert r.status_code == 400


def test_assistant_404_for_tender_in_other_org(client, org_owner, second_org):
    tid = _create_tender(client, org_owner["headers"])

    r = client.post(
        f"/tenders/{tid}/assistant",
        json={"question": "Am I eligible?"},
        headers=second_org["headers"],
    )
    assert r.status_code == 404


def test_assistant_streams_error_from_gemini_failure(client, org_owner):
    headers = org_owner["headers"]
    tid = _create_tender(client, headers)

    def failing_stream(tender_analysis, kb, history, question, language):
        yield "partial answer "
        raise RuntimeError("Gemini API Error: quota exceeded")

    with patch("routers.tenders.stream_assistant_reply", side_effect=failing_stream):
        r = client.post(
            f"/tenders/{tid}/assistant",
            json={"question": "Am I eligible?"},
            headers=headers,
        )

    assert r.status_code == 200
    events = _parse_sse(r.text)
    assert any(e["type"] == "error" and "quota exceeded" in e["detail"] for e in events)


def test_assistant_org_member_without_ownership_can_still_ask(client, org_with_member):
    """Read-only Q&A shouldn't require _can_modify_tender — any org member can ask."""
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, owner_headers)

    with patch("routers.tenders.stream_assistant_reply", return_value=iter(["fine"])):
        r = client.post(
            f"/tenders/{tid}/assistant",
            json={"question": "How strong is our bid?"},
            headers=member_headers,
        )
    assert r.status_code == 200
