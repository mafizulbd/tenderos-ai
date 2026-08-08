"""Background job scheduling.

Currently just periodic AI Tender Discovery refresh, replacing the manual-click-only
trigger with a recurring scan so the discovery pool stays fresh without user action.
Disabled under TESTING (see main.py) to keep the test suite hermetic and fast.
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

DISCOVERY_REFRESH_INTERVAL_HOURS = float(os.getenv("DISCOVERY_REFRESH_INTERVAL_HOURS", "6"))

_scheduler: BackgroundScheduler | None = None


def _run_discovery_job() -> None:
    from routers.discovery import run_discovery_sync

    logger.info("Scheduled discovery refresh starting")
    run_discovery_sync()
    logger.info("Scheduled discovery refresh finished")


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
    _scheduler.start()
    logger.info("Discovery scheduler started (every %sh)", DISCOVERY_REFRESH_INTERVAL_HOURS)
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
