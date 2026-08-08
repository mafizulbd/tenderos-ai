"""Background job scheduling.

Two recurring jobs, both disabled under TESTING (see main.py) to keep the test
suite hermetic and fast:
- AI Tender Discovery refresh — replaces the manual-click-only scraper trigger.
- Deadline reminders — SMS/WhatsApp for tenders with an approaching deadline
  (best-effort no-op until TWILIO_* env vars are configured; see sms_client.py).
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

DISCOVERY_REFRESH_INTERVAL_HOURS = float(os.getenv("DISCOVERY_REFRESH_INTERVAL_HOURS", "6"))
DEADLINE_REMINDER_INTERVAL_HOURS = float(os.getenv("DEADLINE_REMINDER_INTERVAL_HOURS", "24"))

_scheduler: BackgroundScheduler | None = None


def _run_discovery_job() -> None:
    from routers.discovery import run_discovery_sync

    logger.info("Scheduled discovery refresh starting")
    run_discovery_sync()
    logger.info("Scheduled discovery refresh finished")


def _run_deadline_reminders_job() -> None:
    from routers.notifications import send_deadline_reminders

    logger.info("Scheduled deadline reminder sweep starting")
    sent = send_deadline_reminders()
    logger.info("Scheduled deadline reminder sweep finished (%d sent)", sent)


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_discovery_job,
        "interval",
        hours=DISCOVERY_REFRESH_INTERVAL_HOURS,
        id="discovery_refresh",
        next_run_time=None,  # let it fire after the first full interval, not immediately on boot
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        _run_deadline_reminders_job,
        "interval",
        hours=DEADLINE_REMINDER_INTERVAL_HOURS,
        id="deadline_reminders",
        next_run_time=None,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started: discovery every %sh, deadline reminders every %sh",
        DISCOVERY_REFRESH_INTERVAL_HOURS, DEADLINE_REMINDER_INTERVAL_HOURS,
    )
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
