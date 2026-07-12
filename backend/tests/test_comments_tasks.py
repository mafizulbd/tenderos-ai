from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="Comments/Tasks Test Tender"):
    with patch("main.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


# --- Comments ---------------------------------------------------------------

def test_comment_crud(client, org_owner):
    tid = _create_tender(client, org_owner["headers"])

    created = client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": tid, "body": "Looks promising."},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    cid = created.json()["id"]
    assert created.json()["author_email"] == "owner@example.com"

    listed = client.get(f"/comments?entity_type=tender&entity_id={tid}", headers=org_owner["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.patch(f"/comments/{cid}", json={"body": "Edited."}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["body"] == "Edited."
    assert updated.json()["updated_at"] is not None

    deleted = client.delete(f"/comments/{cid}", headers=org_owner["headers"])
    assert deleted.status_code == 200

    listed_after = client.get(f"/comments?entity_type=tender&entity_id={tid}", headers=org_owner["headers"]).json()
    assert listed_after == []


def test_comment_requires_valid_entity(client, org_owner):
    r = client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": 99999, "body": "x"},
        headers=org_owner["headers"],
    )
    assert r.status_code == 404

    r2 = client.post(
        "/comments",
        json={"entity_type": "contract", "entity_id": 1, "body": "x"},
        headers=org_owner["headers"],
    )
    assert r2.status_code == 400

    r3 = client.post(
        "/comments",
        json={"entity_type": "vendor", "entity_id": 99999, "body": "x"},
        headers=org_owner["headers"],
    )
    assert r3.status_code == 404


def test_only_author_can_edit_comment(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, owner_headers)

    created = client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": tid, "body": "Owner's note"},
        headers=owner_headers,
    )
    cid = created.json()["id"]

    edit_attempt = client.patch(f"/comments/{cid}", json={"body": "hijack"}, headers=member_headers)
    assert edit_attempt.status_code == 403


def test_owner_admin_can_delete_others_comment(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, owner_headers)

    created = client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": tid, "body": "Member's note"},
        headers=member_headers,
    )
    cid = created.json()["id"]

    # Member can't delete another member's comment (only their own, or owner/admin can)
    deleted = client.delete(f"/comments/{cid}", headers=owner_headers)
    assert deleted.status_code == 200


def test_comments_cross_org_isolation(client, org_owner, second_org):
    tid = _create_tender(client, org_owner["headers"])
    r = client.post(
        "/comments",
        json={"entity_type": "tender", "entity_id": tid, "body": "x"},
        headers=second_org["headers"],
    )
    assert r.status_code == 404


# --- Tasks --------------------------------------------------------------------

def test_task_crud_and_assignment(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    member_user_id = org_with_member["member"]["user_id"]
    tid = _create_tender(client, owner_headers)

    created = client.post(
        "/tasks",
        json={
            "entity_type": "tender",
            "entity_id": tid,
            "title": "Prepare bid security",
            "assignee_user_id": member_user_id,
            "due_date": "2026-12-31",
        },
        headers=owner_headers,
    )
    assert created.status_code == 200
    task = created.json()
    assert task["status"] == "open"
    assert task["assignee_email"] == "member@example.com"
    tid_task = task["id"]

    # Assignee can update status.
    updated = client.patch(f"/tasks/{tid_task}", json={"status": "in_progress"}, headers=member_headers)
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"

    mine = client.get("/tasks/mine", headers=member_headers)
    assert mine.status_code == 200
    assert [t["id"] for t in mine.json()] == [tid_task]
    assert mine.json()[0]["assignee_email"] == "member@example.com"

    filtered = client.get(f"/tasks?entity_type=tender&entity_id={tid}&status=in_progress", headers=owner_headers)
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1


def test_task_standalone_no_entity(client, org_owner):
    created = client.post("/tasks", json={"title": "Org-wide follow-up"}, headers=org_owner["headers"])
    assert created.status_code == 200
    assert created.json()["entity_type"] is None


def test_task_invalid_status_rejected(client, org_owner):
    created = client.post("/tasks", json={"title": "T"}, headers=org_owner["headers"])
    tid_task = created.json()["id"]
    r = client.patch(f"/tasks/{tid_task}", json={"status": "bogus"}, headers=org_owner["headers"])
    assert r.status_code == 400


def test_unrelated_member_cannot_edit_or_delete_task(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]

    created = client.post("/tasks", json={"title": "Owner-only task"}, headers=owner_headers)
    tid_task = created.json()["id"]

    edit = client.patch(f"/tasks/{tid_task}", json={"status": "done"}, headers=member_headers)
    assert edit.status_code == 403

    # Assignee CAN edit but not delete; here member is neither creator nor assignee.
    delete = client.delete(f"/tasks/{tid_task}", headers=member_headers)
    assert delete.status_code == 403


def test_assignee_can_edit_but_not_delete(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    member_user_id = org_with_member["member"]["user_id"]

    created = client.post(
        "/tasks",
        json={"title": "Assigned task", "assignee_user_id": member_user_id},
        headers=owner_headers,
    )
    tid_task = created.json()["id"]

    edit = client.patch(f"/tasks/{tid_task}", json={"status": "done"}, headers=member_headers)
    assert edit.status_code == 200

    delete = client.delete(f"/tasks/{tid_task}", headers=member_headers)
    assert delete.status_code == 403

    owner_delete = client.delete(f"/tasks/{tid_task}", headers=owner_headers)
    assert owner_delete.status_code == 200


def test_tasks_cross_org_isolation(client, org_owner, second_org):
    created = client.post("/tasks", json={"title": "Org A task"}, headers=org_owner["headers"])
    tid_task = created.json()["id"]

    other_headers = second_org["headers"]
    assert client.patch(f"/tasks/{tid_task}", json={"status": "done"}, headers=other_headers).status_code == 404
    assert client.delete(f"/tasks/{tid_task}", headers=other_headers).status_code == 404

    other_list = client.get("/tasks", headers=other_headers).json()
    assert other_list == []
