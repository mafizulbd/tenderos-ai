"""Notification routes (list, mark-read, mark-all-read).

Computed, non-persisted reminders (deadlines, high-score tenders, contract
expiry, cert expiry) are merged into the list response here as well.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import _get_knowledge_base, get_current_membership, get_current_user, get_db
from models import Contract, Notification, OrgMembership, Tender, User

router = APIRouter()

# ---------------------------------------------------------------------------
# Calendar & Notifications
# ---------------------------------------------------------------------------


def _computed_reminders(db: Session, current_user: User, membership: OrgMembership) -> list[dict]:
    """Deadline/high-score/cert/contract-expiry reminders, recomputed on every
    call (not persisted — there's nothing meaningful to mark 'read' on a fact
    like 'this deadline is in 3 days', it's just always true until it isn't)."""
    now = datetime.utcnow()
    reminders: list[dict] = []

    upcoming = (
        db.query(Tender)
        .filter(
            Tender.organization_id == membership.organization_id,
            Tender.deadline.isnot(None),
            Tender.deadline >= now,
            Tender.deadline <= now + timedelta(days=14),
        )
        .order_by(Tender.deadline.asc())
        .all()
    )
    for t in upcoming:
        days_left = (t.deadline - now).days
        urgency = "critical" if days_left <= 2 else "warning" if days_left <= 5 else "info"
        reminders.append({
            "id": None, "persisted": False, "read_at": None,
            "type": "deadline", "entity_type": "tender", "entity_id": t.id,
            "title": t.title, "deadline": t.deadline, "days_left": days_left,
            "urgency": urgency,
            "message": (
                f"{'URGENT: ' if urgency == 'critical' else ''}"
                f"Tender \"{t.title}\" deadline in {days_left} day{'s' if days_left != 1 else ''}."
            ),
        })

    high_score_reviewing = (
        db.query(Tender)
        .filter(
            Tender.organization_id == membership.organization_id,
            Tender.bid_status == "reviewing",
            Tender.bid_score >= 70,
        )
        .order_by(Tender.bid_score.desc())
        .limit(5)
        .all()
    )
    for t in high_score_reviewing:
        if any(r["entity_id"] == t.id and r["type"] == "deadline" for r in reminders):
            continue
        reminders.append({
            "id": None, "persisted": False, "read_at": None,
            "type": "high_score", "entity_type": "tender", "entity_id": t.id,
            "title": t.title, "deadline": t.deadline,
            "days_left": (t.deadline - now).days if t.deadline else None,
            "urgency": "info",
            "message": (
                f"High-opportunity tender \"{t.title}\" (score {t.bid_score}/100) "
                "is still under review. Consider submitting."
            ),
        })

    contracts_expiring = (
        db.query(Contract)
        .filter(
            Contract.organization_id == membership.organization_id,
            Contract.status == "active",
            Contract.end_date.isnot(None),
            Contract.end_date >= now,
            Contract.end_date <= now + timedelta(days=30),
        )
        .order_by(Contract.end_date.asc())
        .all()
    )
    for c in contracts_expiring:
        days_left = (c.end_date - now).days
        urgency = "critical" if days_left <= 7 else "warning" if days_left <= 14 else "info"
        reminders.append({
            "id": None, "persisted": False, "read_at": None,
            "type": "contract_expiry", "entity_type": "contract", "entity_id": c.id,
            "title": c.title, "deadline": c.end_date, "days_left": days_left,
            "urgency": urgency,
            "message": f"Contract \"{c.title}\" ends in {days_left} day{'s' if days_left != 1 else ''}.",
        })

    try:
        kb = _get_knowledge_base(current_user)
        for cert in kb.get("certifications", []):
            exp_str = cert.get("expiry_date") or cert.get("expiry") or ""
            if not exp_str:
                continue
            try:
                exp_dt = datetime.fromisoformat(exp_str[:10])
            except ValueError:
                continue
            days_until_exp = (exp_dt - now).days
            if -30 <= days_until_exp <= 60:
                urgency = "critical" if days_until_exp < 0 else ("warning" if days_until_exp <= 14 else "info")
                name = cert.get("name") or cert.get("cert_name") or "Certificate"
                reminders.append({
                    "id": None, "persisted": False, "read_at": None,
                    "type": "cert_expiry", "entity_type": None, "entity_id": None,
                    "title": name, "deadline": exp_dt, "days_left": days_until_exp,
                    "urgency": urgency,
                    "message": (
                        f"{'EXPIRED: ' if days_until_exp < 0 else ''}"
                        f"Certificate \"{name}\" "
                        f"{'expired' if days_until_exp < 0 else 'expires'} "
                        f"{exp_dt.strftime('%d %b %Y')}."
                    ),
                })
    except Exception:
        pass

    return reminders


def _notification_response(n: Notification) -> dict:
    return {
        "id": n.id, "persisted": True,
        "type": n.type, "entity_type": n.entity_type, "entity_id": n.entity_id,
        "title": n.title, "message": n.message or "", "urgency": n.urgency or "info",
        "read_at": n.read_at, "created_at": n.created_at,
    }


@router.get("/notifications")
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership: OrgMembership = Depends(get_current_membership),
):
    query = db.query(Notification).filter(
        Notification.organization_id == membership.organization_id,
        Notification.user_id == membership.user_id,
    )
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    persisted = query.order_by(Notification.id.desc()).limit(max(1, min(limit, 200))).all()

    combined = [_notification_response(n) for n in persisted] + _computed_reminders(db, current_user, membership)
    urgency_order = {"critical": 0, "warning": 1, "info": 2}

    def sort_key(r: dict):
        unread = 0 if (not r["persisted"] or r["read_at"] is None) else 1
        urgency_rank = urgency_order.get(r["urgency"], 9)
        ts = r.get("created_at") or r.get("deadline") or datetime.utcnow()
        return (unread, urgency_rank, -ts.timestamp())

    combined.sort(key=sort_key)

    unread_count = sum(1 for r in combined if not r["persisted"] or r["read_at"] is None)
    return {"notifications": combined, "count": len(combined), "unread_count": unread_count}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.organization_id == membership.organization_id,
        Notification.user_id == membership.user_id,
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notification.read_at = datetime.utcnow()
    db.commit()
    return _notification_response(notification)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.organization_id == membership.organization_id,
        Notification.user_id == membership.user_id,
        Notification.read_at.is_(None),
    ).update({"read_at": now})
    db.commit()
    return {"detail": "All notifications marked read."}
