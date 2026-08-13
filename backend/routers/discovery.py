"""AI Tender Discovery routes.

NOTE: this module imports the scraper functions from the top-level
`backend/discovery.py` module (a different file — the scrapers themselves).
Fully-qualified import used below to keep the two apart.
"""

import threading

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import discovery as discovery_scrapers
from database import SessionLocal
from deps import get_current_membership, get_current_user, get_db, get_tender_response, limiter
from models import DiscoveredTender, OrgMembership, Tender, User
from timeutils import utcnow

router = APIRouter()

# ---------------------------------------------------------------------------
# AI Tender Discovery
# ---------------------------------------------------------------------------

_discovery_state: dict = {"running": False, "last_run": None, "count": 0}


def _sync_discovered(db: Session, notices: list[dict]) -> int:
    new_count = 0
    for n in notices:
        existing = db.query(DiscoveredTender).filter(
            DiscoveredTender.external_id == n["external_id"]
        ).first()
        if existing:
            continue
        dt = DiscoveredTender(
            source=n.get("source", ""),
            external_id=n["external_id"],
            title=n.get("title", "")[:500],
            description=(n.get("description") or "")[:800],
            category=(n.get("category") or "")[:300],
            deadline=n.get("deadline"),
            estimated_value=n.get("estimated_value", "")[:200],
            url=(n.get("url") or "")[:500],
            country=n.get("country", "Bangladesh"),
        )
        db.add(dt)
        new_count += 1
    db.commit()
    return new_count


@router.get("/discover")
def list_discovered(
    source: str = "",
    search: str = "",
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(DiscoveredTender)
    if source.strip():
        query = query.filter(DiscoveredTender.source == source.strip())
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(DiscoveredTender.title.ilike(term), DiscoveredTender.description.ilike(term))
        )
    items = query.order_by(DiscoveredTender.discovered_at.desc()).limit(max(1, min(limit, 200))).all()
    return {
        "tenders": [
            {
                "id": d.id,
                "source": d.source,
                "external_id": d.external_id,
                "title": d.title,
                "description": (d.description or "")[:300],
                "category": d.category,
                "deadline": d.deadline,
                "estimated_value": d.estimated_value,
                "url": d.url,
                "country": d.country,
                "discovered_at": d.discovered_at,
            }
            for d in items
        ],
        "total": len(items),
        "state": _discovery_state,
    }


def run_discovery_sync() -> None:
    """Run all scrapers and sync results into the DB. Blocking — call off the request thread.

    Shared by the manual `/discover/refresh` endpoint and the scheduled background job
    (see `scheduler.py`), so both paths stay in lockstep with `_discovery_state`.
    """
    if _discovery_state["running"]:
        return
    _discovery_state["running"] = True
    try:
        notices = discovery_scrapers.run_all_scrapers()
        fresh_db = SessionLocal()
        try:
            added = _sync_discovered(fresh_db, notices)
            _discovery_state["count"] = added
            _discovery_state["last_run"] = utcnow().isoformat()
        finally:
            fresh_db.close()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Discovery refresh failed: %s", exc)
    finally:
        _discovery_state["running"] = False


@router.post("/discover/refresh")
@limiter.limit("3/minute")
async def refresh_discovery(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if _discovery_state["running"]:
        return {"detail": "Discovery already running.", "state": _discovery_state}

    threading.Thread(target=run_discovery_sync, daemon=True).start()
    return {"detail": "Discovery refresh started.", "state": _discovery_state}


@router.post("/discover/{discovered_id}/import")
def import_discovered_tender(
    discovered_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership: OrgMembership = Depends(get_current_membership),
):
    dt = db.query(DiscoveredTender).filter(DiscoveredTender.id == discovered_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Discovered tender not found.")

    summary = (
        f"Discovered from {dt.source}.\n\n"
        f"Category: {dt.category or 'N/A'}\n"
        f"Estimated Value: {dt.estimated_value or 'N/A'}\n"
        f"Country: {dt.country}\n"
        f"Source URL: {dt.url or 'N/A'}\n\n"
        f"{dt.description or ''}"
    ).strip()

    tender = Tender(
        user_id=current_user.id,
        organization_id=membership.organization_id,
        title=dt.title,
        language="english",
        status="completed",
        file_name="",
        file_type="",
        file_size=0,
        deadline=dt.deadline,
        bid_status="reviewing",
        original_text=summary,
        summary=summary,
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)
    return get_tender_response(tender)
