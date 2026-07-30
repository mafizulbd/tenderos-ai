from unittest.mock import patch

from tests.test_tenders import MOCK_RESULT, _txt_file


def _create_tender(client, headers, title="Contract Test Tender"):
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
    r = client.post("/vendors", json={"name": name}, headers=headers)
    assert r.status_code == 200
    return r.json()["id"]


def test_contract_crud(client, org_owner):
    created = client.post(
        "/contracts",
        json={"title": "Road Maintenance Agreement", "contract_value": "5,000,000", "currency": "BDT"},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    contract = created.json()
    assert contract["status"] == "draft"
    cid = contract["id"]

    listed = client.get("/contracts", headers=org_owner["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    got = client.get(f"/contracts/{cid}", headers=org_owner["headers"])
    assert got.status_code == 200
    assert got.json()["title"] == "Road Maintenance Agreement"

    updated = client.patch(f"/contracts/{cid}", json={"status": "active"}, headers=org_owner["headers"])
    assert updated.status_code == 200
    assert updated.json()["status"] == "active"

    deleted = client.delete(f"/contracts/{cid}", headers=org_owner["headers"])
    assert deleted.status_code == 200

    listed_after = client.get("/contracts", headers=org_owner["headers"]).json()
    assert listed_after == []


def test_contract_linked_to_tender_and_vendor(client, org_owner):
    tid = _create_tender(client, org_owner["headers"])
    vid = _create_vendor(client, org_owner["headers"])

    created = client.post(
        "/contracts",
        json={"title": "Supply Agreement", "tender_id": tid, "vendor_id": vid},
        headers=org_owner["headers"],
    )
    assert created.status_code == 200
    assert created.json()["tender_id"] == tid
    assert created.json()["vendor_id"] == vid

    by_tender = client.get(f"/contracts?tender_id={tid}", headers=org_owner["headers"]).json()
    assert len(by_tender) == 1
    by_vendor = client.get(f"/contracts?vendor_id={vid}", headers=org_owner["headers"]).json()
    assert len(by_vendor) == 1


def test_contract_requires_tender_and_vendor_in_same_org(client, org_owner, second_org):
    other_tid = _create_tender(client, second_org["headers"])
    other_vid = _create_vendor(client, second_org["headers"])

    bad_tender = client.post(
        "/contracts", json={"title": "X", "tender_id": other_tid}, headers=org_owner["headers"],
    )
    assert bad_tender.status_code == 404

    bad_vendor = client.post(
        "/contracts", json={"title": "X", "vendor_id": other_vid}, headers=org_owner["headers"],
    )
    assert bad_vendor.status_code == 404


def test_invalid_contract_status_rejected(client, org_owner):
    created = client.post("/contracts", json={"title": "X"}, headers=org_owner["headers"])
    cid = created.json()["id"]
    r = client.patch(f"/contracts/{cid}", json={"status": "bogus"}, headers=org_owner["headers"])
    assert r.status_code == 400


def test_only_creator_or_admin_can_modify_contract(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]

    created = client.post("/contracts", json={"title": "Member's contract"}, headers=member_headers)
    cid = created.json()["id"]

    # Owner (admin-equivalent) can edit a member's contract.
    edited = client.patch(f"/contracts/{cid}", json={"status": "active"}, headers=owner_headers)
    assert edited.status_code == 200


def test_unrelated_member_cannot_modify_contract(client, org_with_member):
    owner_headers = org_with_member["owner"]["headers"]
    member_headers = org_with_member["member"]["headers"]

    created = client.post("/contracts", json={"title": "Owner's contract"}, headers=owner_headers)
    cid = created.json()["id"]

    edited = client.patch(f"/contracts/{cid}", json={"status": "active"}, headers=member_headers)
    assert edited.status_code == 403

    deleted = client.delete(f"/contracts/{cid}", headers=member_headers)
    assert deleted.status_code == 403


def test_contracts_cross_org_isolation(client, org_owner, second_org):
    created = client.post("/contracts", json={"title": "Org A contract"}, headers=org_owner["headers"])
    cid = created.json()["id"]

    other_headers = second_org["headers"]
    assert client.get(f"/contracts/{cid}", headers=other_headers).status_code == 404
    assert client.patch(f"/contracts/{cid}", json={"status": "active"}, headers=other_headers).status_code == 404
    assert client.get("/contracts", headers=other_headers).json() == []


def test_comments_and_tasks_work_on_contract_entity(client, org_owner):
    created = client.post("/contracts", json={"title": "X"}, headers=org_owner["headers"])
    cid = created.json()["id"]

    comment = client.post(
        "/comments",
        json={"entity_type": "contract", "entity_id": cid, "body": "Renewal due next quarter."},
        headers=org_owner["headers"],
    )
    assert comment.status_code == 200

    task = client.post(
        "/tasks",
        json={"entity_type": "contract", "entity_id": cid, "title": "Renew performance security"},
        headers=org_owner["headers"],
    )
    assert task.status_code == 200

    listed = client.get(f"/tasks?entity_type=contract&entity_id={cid}", headers=org_owner["headers"])
    assert len(listed.json()) == 1
