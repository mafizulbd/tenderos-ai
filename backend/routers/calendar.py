"""Calendar route: unified deadline/contract-end/task-due event feed."""

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from deps import _parse_deadline, get_current_membership, get_db
from models import Contract, OrgMembership, Task as TaskModel, Tender
from timeutils import utcnow

router = APIRouter()


@router.get("/calendar")
def get_calendar(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    now = utcnow()
    range_start = _parse_deadline(from_) or (now - timedelta(days=30))
    range_end = _parse_deadline(to) or (now + timedelta(days=180))

    events: list[dict] = []

    tenders = db.query(Tender).filter(
        Tender.organization_id == membership.organization_id,
        Tender.deadline.isnot(None),
        Tender.deadline >= range_start,
        Tender.deadline <= range_end,
    ).all()
    for t in tenders:
        events.append({
            "date": t.deadline, "type": "tender_deadline",
            "entity_type": "tender", "entity_id": t.id, "title": t.title,
            "urgency": "critical" if (t.deadline - now).days <= 2 else "warning" if (t.deadline - now).days <= 5 else "info",
        })

    contracts = db.query(Contract).filter(
        Contract.organization_id == membership.organization_id,
        Contract.end_date.isnot(None),
        Contract.end_date >= range_start,
        Contract.end_date <= range_end,
    ).all()
    for c in contracts:
        events.append({
            "date": c.end_date, "type": "contract_end",
            "entity_type": "contract", "entity_id": c.id, "title": c.title,
            "urgency": "warning" if (c.end_date - now).days <= 14 else "info",
        })

    tasks = db.query(TaskModel).filter(
        TaskModel.organization_id == membership.organization_id,
        TaskModel.due_date.isnot(None),
        TaskModel.due_date >= range_start,
        TaskModel.due_date <= range_end,
        TaskModel.status.notin_(("done", "cancelled")),
    ).all()
    for tk in tasks:
        events.append({
            "date": tk.due_date, "type": "task_due",
            "entity_type": tk.entity_type, "entity_id": tk.entity_id, "title": tk.title,
            "urgency": "warning" if (tk.due_date - now).days <= 2 else "info",
        })

    events.sort(key=lambda e: e["date"])
    return {"events": events}
