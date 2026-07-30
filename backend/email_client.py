"""Transactional email via Resend, for account verification and password reset.

Best-effort by design: if RESEND_API_KEY isn't set (e.g. local dev) or the API
call fails, we log a warning and move on rather than failing the request that
triggered the email. Signup/login/reset must never break because an email
provider had an outage.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _from_address() -> str:
    return os.getenv("RESEND_FROM_EMAIL", "TenderOS AI <onboarding@resend.dev>")


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000")


def _send(to_email: str, subject: str, html: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not set — skipping email (subject=%r, to=%r)", subject, to_email)
        return
    try:
        resp = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": _from_address(), "to": [to_email], "subject": subject, "html": html},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", to_email, exc)


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{_frontend_url()}/verify-email?token={token}"
    _send(
        to_email,
        "Verify your TenderOS AI account",
        f"""
        <p>Welcome to TenderOS AI.</p>
        <p>Please verify your email address to secure your account:</p>
        <p><a href="{link}">Verify email</a></p>
        <p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
        """,
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{_frontend_url()}/reset-password?token={token}"
    _send(
        to_email,
        "Reset your TenderOS AI password",
        f"""
        <p>We received a request to reset your TenderOS AI password.</p>
        <p><a href="{link}">Reset password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        """,
    )
