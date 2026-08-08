"""SMS + WhatsApp delivery via Twilio, for tender deadline reminders.

Best-effort by design, same pattern as email_client.py: if Twilio credentials
aren't set (e.g. local/staging before the user has a Twilio account) we log a
warning and skip rather than failing the caller. Twilio was picked because one
account covers both plain SMS (works on Bangladesh carriers with no app
required) and WhatsApp Business messaging through the same REST API — no need
for two separate providers.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)

TWILIO_API_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


def _creds() -> tuple[str, str] | None:
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        return None
    return sid, token


def _send(to: str, from_: str | None, body: str, channel: str) -> None:
    creds = _creds()
    if not creds or not from_:
        logger.warning("Twilio not configured — skipping %s reminder (to=%r)", channel, to)
        return
    sid, token = creds
    try:
        resp = requests.post(
            TWILIO_API_URL.format(sid=sid),
            auth=(sid, token),
            data={"To": to, "From": from_, "Body": body},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Twilio %s send failed (to=%r): %s", channel, to, exc)


def send_sms(to_phone: str, message: str) -> None:
    _send(to_phone, os.getenv("TWILIO_SMS_FROM"), message, "SMS")


def send_whatsapp(to_phone: str, message: str) -> None:
    from_number = os.getenv("TWILIO_WHATSAPP_FROM")
    if from_number and not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"
    to = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"
    _send(to, from_number, message, "WhatsApp")
