from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="Approval Test Tender"):
    with patch("main.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


def test_request_approval_sets_pending_status(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])

    r = client.post(f"/tenders/{tender_id}/approval/request", headers=org_owner["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "pending"

    tender = client.get(f"/tenders/{tender_id}", headers=org_owner["headers"]).json()
    assert tender["approval_status"] == "pending"


def test_cannot_request_approval_twice(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])
    client.post(f"/tenders/{tender_id}/approval/request", headers=org_owner["headers"])
    r = client.post(f"/tenders/{tender_id}/approval/request", headers=org_owner["headers"])
    assert r.status_code == 400


def test_member_cannot_decide_own_request(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tender_id = _create_tender(client, owner_headers)

    req = client.post(f"/tenders/{tender_id}/approval/request", headers=owner_headers)
    assert req.status_code == 200

    decide = client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "approved", "note": "hijack"},
        headers=member_headers,
    )
    assert decide.status_code == 403


def test_owner_can_approve_and_reject(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tender_id = _create_tender(client, member_headers)

    client.post(f"/tenders/{tender_id}/approval/request", headers=member_headers)

    decide = client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "approved", "note": "looks good"},
        headers=owner_headers,
    )
    assert decide.status_code == 200
    assert decide.json()["status"] == "approved"
    assert decide.json()["reviewer_note"] == "looks good"

    tender = client.get(f"/tenders/{tender_id}", headers=owner_headers).json()
    assert tender["approval_status"] == "approved"

    # Once decided, a fresh request can be made again (e.g. after revisions).
    reopen = client.post(f"/tenders/{tender_id}/approval/request", headers=member_headers)
    assert reopen.status_code == 200

    reject = client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "rejected", "note": "needs more detail"},
        headers=owner_headers,
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"


def test_decide_without_pending_request_fails(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])
    r = client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "approved"},
        headers=org_owner["headers"],
    )
    assert r.status_code == 400


def test_invalid_decision_value_rejected(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])
    client.post(f"/tenders/{tender_id}/approval/request", headers=org_owner["headers"])
    r = client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "maybe"},
        headers=org_owner["headers"],
    )
    assert r.status_code == 400


def test_cancel_approval_request(client, org_owner):
    tender_id = _create_tender(client, org_owner["headers"])
    client.post(f"/tenders/{tender_id}/approval/request", headers=org_owner["headers"])

    cancel = client.post(f"/tenders/{tender_id}/approval/cancel", headers=org_owner["headers"])
    assert cancel.status_code == 200

    tender = client.get(f"/tenders/{tender_id}", headers=org_owner["headers"]).json()
    assert tender["approval_status"] == "none"


def test_member_cannot_request_approval_for_others_tender(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tender_id = _create_tender(client, owner_headers)

    r = client.post(f"/tenders/{tender_id}/approval/request", headers=member_headers)
    assert r.status_code == 403


def test_approval_history(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    tender_id = _create_tender(client, owner_headers)

    client.post(f"/tenders/{tender_id}/approval/request", headers=owner_headers)
    client.post(
        f"/tenders/{tender_id}/approval/decide",
        json={"decision": "rejected", "note": "no"},
        headers=owner_headers,
    )
    client.post(f"/tenders/{tender_id}/approval/request", headers=owner_headers)

    history = client.get(f"/tenders/{tender_id}/approval/history", headers=owner_headers)
    assert history.status_code == 200
    statuses = [h["status"] for h in history.json()]
    assert statuses == ["pending", "rejected"]


def test_pending_queue_is_org_scoped_and_role_gated(client, org_with_member, second_org):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tender_id = _create_tender(client, owner_headers)
    client.post(f"/tenders/{tender_id}/approval/request", headers=owner_headers)

    # Member cannot see the org-wide approval queue.
    assert client.get("/approvals/pending", headers=member_headers).status_code == 403

    queue = client.get("/approvals/pending", headers=owner_headers)
    assert queue.status_code == 200
    assert [q["tender_id"] for q in queue.json()] == [tender_id]
    assert queue.json()[0]["tender_title"] == "Approval Test Tender"

    # A different organization's owner sees an empty queue, not org A's request.
    other_queue = client.get("/approvals/pending", headers=second_org["headers"])
    assert other_queue.status_code == 200
    assert other_queue.json() == []


def test_cross_org_cannot_act_on_approval(client, org_owner, second_org):
    tender_id = _create_tender(client, org_owner["headers"])
    r = client.post(f"/tenders/{tender_id}/approval/request", headers=second_org["headers"])
    assert r.status_code == 404
