import os
from unittest.mock import MagicMock, patch

import sms_client


def test_send_sms_noop_without_credentials(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    with patch("requests.post") as mock_post:
        sms_client.send_sms("+8801711000000", "Test message")
    mock_post.assert_not_called()


def test_send_sms_calls_twilio_when_configured(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15005550006")
    mock_resp = MagicMock()
    with patch("requests.post", return_value=mock_resp) as mock_post:
        sms_client.send_sms("+8801711000000", "Test message")
    mock_post.assert_called_once()
    _, kwargs = mock_post.call_args
    assert kwargs["data"]["To"] == "+8801711000000"
    assert kwargs["data"]["From"] == "+15005550006"
    assert kwargs["data"]["Body"] == "Test message"
    mock_resp.raise_for_status.assert_called_once()


def test_send_whatsapp_prefixes_numbers(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155238886")
    mock_resp = MagicMock()
    with patch("requests.post", return_value=mock_resp) as mock_post:
        sms_client.send_whatsapp("+8801711000000", "Test message")
    _, kwargs = mock_post.call_args
    assert kwargs["data"]["To"] == "whatsapp:+8801711000000"
    assert kwargs["data"]["From"] == "whatsapp:+14155238886"


def test_send_failure_is_swallowed(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15005550006")
    with patch("requests.post", side_effect=RuntimeError("network down")):
        sms_client.send_sms("+8801711000000", "Test message")  # must not raise
