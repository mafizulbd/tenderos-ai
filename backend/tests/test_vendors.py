from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="Vendor Test Tender"):
    with patch("routers.tenders.analyze_with_gemini", return_value=MOCK_RESULT):
        r = client.post(
            "/tenders/analyze",
            data={"title": title, "language": "english"},
            files={"file": _txt_file()},
            headers=headers,
        )
    assert r.status_code == 200
    return r.json()["id"]


def _create_vendor(client, headers, name="Acme Supplies"):
    r = client.post(
        "/vendors",
        json={"name": name, "category": "supplier", "email": "vendor@acme.com"},
        headers=headers,
    )
    assert r.status_code == 200
    return r.json()["id"]


def test_vendor_crud(client, org_owner):
    vid = _create_vendor(client, org_owner["headers"])

    listed = client.get("/vendors", headers=org_owner["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    got = client.get(f"/vendors/{vid}", headers=org_owner["headers"])
    assert got.status_code == 200
    assert got.json()["name"] == "Acme Supplies"

    updated = client.patch(f"/vendors/{vid}", json={"rating": 4}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["rating"] == 4

    deleted = client.delete(f"/vendors/{vid}", headers=org_owner["headers"])
    assert deleted.status_code == 200

    listed_after = client.get("/vendors", headers=org_owner["headers"]).json()
    assert listed_after == []


def test_vendor_search_and_category_filter(client, org_owner):
    _create_vendor(client, org_owner["headers"], name="Dhaka Steel Co")
    client.post(
        "/vendors",
        json={"name": "Chittagong Transport", "category": "logistics"},
        headers=org_owner["headers"],
    )

    search = client.get("/vendors?search=Dhaka", headers=org_owner["headers"]).json()
    assert len(search) == 1
    assert search[0]["name"] == "Dhaka Steel Co"

    by_category = client.get("/vendors?category=logistics", headers=org_owner["headers"]).json()
    assert len(by_category) == 1
    assert by_category[0]["name"] == "Chittagong Transport"


def test_only_creator_or_admin_can_modify_vendor(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    vid = _create_vendor(client, member_headers)

    # Owner (admin-equivalent) can edit a member's vendor.
    edited = client.patch(f"/vendors/{vid}", json={"notes": "verified"}, headers=owner_headers)
    assert edited.status_code == 200


def test_unrelated_member_cannot_modify_vendor(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    vid = _create_vendor(client, owner_headers)

    edited = client.patch(f"/vendors/{vid}", json={"notes": "hijack"}, headers=member_headers)
    assert edited.status_code == 403

    deleted = client.delete(f"/vendors/{vid}", headers=member_headers)
    assert deleted.status_code == 403


def test_vendors_cross_org_isolation(client, org_owner, second_org):
    vid = _create_vendor(client, org_owner["headers"])
    other_headers = second_org["headers"]

    assert client.get(f"/vendors/{vid}", headers=other_headers).status_code == 404
    assert client.patch(f"/vendors/{vid}", json={"notes": "x"}, headers=other_headers).status_code == 404
    assert client.get("/vendors", headers=other_headers).json() == []


def test_link_and_unlink_vendor_to_tender(client, org_owner):
    tid = _create_tender(client, org_owner["headers"])
    vid = _create_vendor(client, org_owner["headers"])

    link = client.post(
        f"/tenders/{tid}/vendors",
        json={"vendor_id": vid, "role": "subcontractor", "notes": "civil works"},
        headers=org_owner["headers"],
    )
    assert link.status_code == 200
    assert link.json()["vendor"]["id"] == vid
    assert link.json()["role"] == "subcontractor"

    listed = client.get(f"/tenders/{tid}/vendors", headers=org_owner["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    dup = client.post(
        f"/tenders/{tid}/vendors", json={"vendor_id": vid}, headers=org_owner["headers"],
    )
    assert dup.status_code == 409

    unlinked = client.delete(f"/tenders/{tid}/vendors/{vid}", headers=org_owner["headers"])
    assert unlinked.status_code == 200

    listed_after = client.get(f"/tenders/{tid}/vendors", headers=org_owner["headers"]).json()
    assert listed_after == []


def test_member_cannot_link_vendor_to_others_tender(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]
    tid = _create_tender(client, owner_headers)
    vid = _create_vendor(client, member_headers)

    link = client.post(
        f"/tenders/{tid}/vendors", json={"vendor_id": vid}, headers=member_headers,
    )
    assert link.status_code == 403


def test_link_requires_vendor_in_same_org(client, org_owner, second_org):
    tid = _create_tender(client, org_owner["headers"])
    other_vid = _create_vendor(client, second_org["headers"])

    link = client.post(
        f"/tenders/{tid}/vendors", json={"vendor_id": other_vid}, headers=org_owner["headers"],
    )
    assert link.status_code == 404


def test_comments_and_tasks_work_on_vendor_entity(client, org_owner):
    vid = _create_vendor(client, org_owner["headers"])

    comment = client.post(
        "/comments",
        json={"entity_type": "vendor", "entity_id": vid, "body": "Reliable supplier."},
        headers=org_owner["headers"],
    )
    assert comment.status_code == 200

    task = client.post(
        "/tasks",
        json={"entity_type": "vendor", "entity_id": vid, "title": "Renew vendor agreement"},
        headers=org_owner["headers"],
    )
    assert task.status_code == 200

    listed = client.get(f"/comments?entity_type=vendor&entity_id={vid}", headers=org_owner["headers"])
    assert len(listed.json()) == 1
