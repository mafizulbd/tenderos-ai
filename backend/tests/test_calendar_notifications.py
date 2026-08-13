from datetime import timedelta
from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file
from timeutils import utcnow


def _create_tender(client, headers, title="Calendar Test Tender", deadline=None):
    data = {"title": title, "language": "english"}
    if deadline:
        data["deadline"] = deadline
    with patch("routers.tenders.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data=data,
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


def _iso(days_from_now: int) -> str:
    return (utcnow() + timedelta(days=days_from_now)).strftime("%Y-%m-%d")


# --- Event-driven notifications ------------------------------------------------

def test_approval_requested_notifies_admins(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, member_headers)

    r = client.post(f"/tenders/{tid}/approval/request", headers=member_headers)
    assert r.status_code == 200

    notifications = client.get("/notifications", headers=owner_headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    assert any(n["type"] == "approval_requested" for n in persisted)

    # The requester themselves should not get a self-notification.
    member_notifications = client.get("/notifications", headers=member_headers).json()["notifications"]
    assert not any(n["persisted"] and n["type"] == "approval_requested" for n in member_notifications)


def test_approval_decided_notifies_requester(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, member_headers)

    client.post(f"/tenders/{tid}/approval/request", headers=member_headers)
    client.post(
        f"/tenders/{tid}/approval/decide",
        json={"decision": "approved", "note": "go ahead"},
        headers=owner_headers,
    )

    notifications = client.get("/notifications", headers=member_headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    assert any(n["type"] == "approval_decided" for n in persisted)


def test_task_assignment_notifies_assignee(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    member_id = org_with_member["member"]["user_id"]

    client.post(
        "/tasks",
        json={"title": "Prepare docs", "assignee_user_id": member_id},
        headers=owner_headers,
    )

    notifications = client.get("/notifications", headers=member_headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    assert any(n["type"] == "task_assigned" for n in persisted)


def test_comment_notifies_entity_owner(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, owner_headers)

    client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": tid, "body": "Please review."},
        headers=member_headers,
    )

    notifications = client.get("/notifications", headers=owner_headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    assert any(n["type"] == "comment_added" for n in persisted)


def test_invite_accept_notifies_inviter(client, org_owner):
    invite = client.post(
        "/orgs/me/invites",
        json={"email": "joiner@example.com", "role": "member"},
        headers=org_owner["headers"],
    )
    token = invite.json()["token"]
    signup = client.post("/auth/signup", json={"email": "joiner@example.com", "password": "password123"})
    joiner_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    client.post(f"/invites/{token}/accept", headers=joiner_headers)

    notifications = client.get("/notifications", headers=org_owner["headers"]).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    assert any(n["type"] == "member_invited" for n in persisted)


# --- Read / read-all -------------------------------------------------------------

def test_mark_notification_read(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, member_headers)
    client.post(f"/tenders/{tid}/approval/request", headers=member_headers)

    notifications = client.get("/notifications", headers=owner_headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"]]
    nid = persisted[0]["id"]

    r = client.post(f"/notifications/{nid}/read", headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["read_at"] is not None

    after = client.get("/notifications?unread_only=true", headers=owner_headers).json()["notifications"]
    assert nid not in [n["id"] for n in after if n["persisted"]]


def test_mark_all_notifications_read(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid1 = _create_tender(client, member_headers, title="T1")
    tid2 = _create_tender(client, member_headers, title="T2")
    client.post(f"/tenders/{tid1}/approval/request", headers=member_headers)
    client.post(f"/tenders/{tid2}/approval/request", headers=member_headers)

    r = client.post("/notifications/read-all", headers=owner_headers)
    assert r.status_code == 200

    after = client.get("/notifications?unread_only=true", headers=owner_headers).json()["notifications"]
    assert not any(n["persisted"] for n in after)


def test_notifications_are_org_and_user_scoped(client, org_with_member, second_org):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, member_headers)
    client.post(f"/tenders/{tid}/approval/request", headers=member_headers)

    other_notifications = client.get("/notifications", headers=second_org["headers"]).json()["notifications"]
    assert not any(n["persisted"] for n in other_notifications)


def test_cannot_mark_others_notification_read(client, org_with_member, second_org):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, member_headers)
    client.post(f"/tenders/{tid}/approval/request", headers=member_headers)

    notifications = client.get("/notifications", headers=owner_headers).json()["notifications"]
    nid = [n for n in notifications if n["persisted"]][0]["id"]

    r = client.post(f"/notifications/{nid}/read", headers=second_org["headers"])
    assert r.status_code == 404


# --- Computed reminders folded into /notifications --------------------------------

def test_computed_deadline_reminder_appears_in_notifications(client, org_owner):
    _create_tender(client, org_owner["headers"], deadline=_iso(2))

    notifications = client.get("/notifications", headers=org_owner["headers"]).json()["notifications"]
    computed = [n for n in notifications if not n["persisted"]]
    assert any(n["type"] == "deadline" for n in computed)


# --- Calendar ------------------------------------------------------------------

def test_calendar_includes_tender_deadline_and_task_due_date(client, org_owner):
    tid = _create_tender(client, org_owner["headers"], deadline=_iso(10))
    client.post(
        "/tasks",
        json={"title": "Follow up", "due_date": _iso(5)},
        headers=org_owner["headers"],
    )

    r = client.get("/calendar", headers=org_owner["headers"])
    assert r.status_code == 200
    events = r.json()["events"]
    types = {e["type"] for e in events}
    assert "tender_deadline" in types
    assert "task_due" in types
    assert any(e["entity_id"] == tid for e in events if e["type"] == "tender_deadline")


def test_calendar_is_org_scoped(client, org_owner, second_org):
    _create_tender(client, org_owner["headers"], deadline=_iso(3))

    other_events = client.get("/calendar", headers=second_org["headers"]).json()["events"]
    assert other_events == []


def test_reminders_endpoint_retired(client, org_owner):
    r = client.get("/reminders", headers=org_owner["headers"])
    assert r.status_code == 404
