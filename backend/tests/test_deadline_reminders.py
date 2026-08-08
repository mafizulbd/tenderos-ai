"""SMS/WhatsApp deadline reminder sweep (routers.notifications.send_deadline_reminders).

sms_client.send_sms/send_whatsapp are mocked throughout — no real Twilio calls.
"""

from datetime import datetime, timedelta
from unittest.mock import patch

from routers.notifications import send_deadline_reminders
from tests.test_calendar_notifications import _create_tender, _iso


def _set_phone(client, headers, phone: str = "+8801711000000"):
    r = client.put(
        "/me/profile",
        json={"contact_name": "Test User", "phone": phone, "address": ""},
        headers=headers,
    )
    assert r.status_code == 200


def test_reminder_sent_for_urgent_deadline(client, org_owner):
    headers = org_owner["headers"]
    _set_phone(client, headers)
    _create_tender(client, headers, title="Urgent Tender", deadline=_iso(1))

    with patch("sms_client.send_sms") as mock_sms, patch("sms_client.send_whatsapp") as mock_wa:
        sent = send_deadline_reminders()

    assert sent == 1
    mock_sms.assert_called_once()
    mock_wa.assert_called_once()
    assert mock_sms.call_args[0][0] == "+8801711000000"

    notifications = client.get("/notifications", headers=headers).json()["notifications"]
    persisted = [n for n in notifications if n["persisted"] and n["type"] == "deadline_reminder_sent"]
    assert len(persisted) == 1
    assert persisted[0]["read_at"] is not None  # bookkeeping row, not an actionable unread item


def test_reminder_not_resent_same_day(client, org_owner):
    headers = org_owner["headers"]
    _set_phone(client, headers)
    _create_tender(client, headers, title="Urgent Tender", deadline=_iso(1))

    with patch("sms_client.send_sms") as mock_sms, patch("sms_client.send_whatsapp"):
        first = send_deadline_reminders()
        second = send_deadline_reminders()

    assert first == 1
    assert second == 0
    assert mock_sms.call_count == 1


def test_no_reminder_without_phone_on_file(client, org_owner):
    headers = org_owner["headers"]
    _create_tender(client, headers, title="Urgent Tender", deadline=_iso(1))

    with patch("sms_client.send_sms") as mock_sms:
        sent = send_deadline_reminders()

    assert sent == 0
    mock_sms.assert_not_called()


def test_no_reminder_for_far_off_deadline(client, org_owner):
    headers = org_owner["headers"]
    _set_phone(client, headers)
    _create_tender(client, headers, title="Distant Tender", deadline=_iso(13))

    with patch("sms_client.send_sms") as mock_sms:
        sent = send_deadline_reminders()

    assert sent == 0
    mock_sms.assert_not_called()
