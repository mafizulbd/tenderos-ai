"""Approval workflow routes: request/cancel/decide approval, history, pending list."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import (
    _can_modify_tender, _get_org_tender, _notify, _notify_admins,
    get_current_membership, get_db, require_role,
)
from models import ApprovalRequest, OrgMembership, Tender
from schemas import ApprovalDecision

router = APIRouter()

# ---------------------------------------------------------------------------
# Approval Workflow
# ---------------------------------------------------------------------------

VALID_APPROVAL_DECISIONS = {"approved", "rejected"}


def _approval_response(a: ApprovalRequest) -> dict:
    return {
        "id": a.id,
        "tender_id": a.tender_id,
        "requested_by_user_id": a.requested_by_user_id,
        "status": a.status,
        "reviewer_user_id": a.reviewer_user_id,
        "reviewer_note": a.reviewer_note or "",
        "requested_at": a.requested_at,
        "reviewed_at": a.reviewed_at,
    }


@router.post("/tenders/{tender_id}/approval/request")
def request_approval(
    tender_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    if not _can_modify_tender(tender, membership):
        raise HTTPException(status_code=403, detail="You can only request approval for tenders you created.")
    if tender.approval_status == "pending":
        raise HTTPException(status_code=400, detail="This tender already has a pending approval request.")

    approval = ApprovalRequest(
        organization_id=membership.organization_id,
        tender_id=tender.id,
        requested_by_user_id=membership.user_id,
        status="pending",
    )
    db.add(approval)
    tender.approval_status = "pending"
    _notify_admins(
        db, membership.organization_id, membership.user_id, "approval_requested",
        title=f'Approval requested: "{tender.title}"',
        urgency="warning", entity_type="tender", entity_id=tender.id,
    )
    db.commit()
    db.refresh(approval)
    return _approval_response(approval)


@router.post("/tenders/{tender_id}/approval/cancel")
def cancel_approval(
    tender_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    if not _can_modify_tender(tender, membership):
        raise HTTPException(status_code=403, detail="You can only cancel approval requests for tenders you created.")

    pending = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.tender_id == tender.id, ApprovalRequest.status == "pending")
        .order_by(ApprovalRequest.id.desc())
        .first()
    )
    if not pending:
        raise HTTPException(status_code=400, detail="This tender has no pending approval request.")

    pending.status = "cancelled"
    pending.reviewed_at = datetime.utcnow()
    tender.approval_status = "none"
    db.commit()
    return {"detail": "Approval request cancelled."}


@router.post("/tenders/{tender_id}/approval/decide")
def decide_approval(
    tender_id: int,
    payload: ApprovalDecision,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    if payload.decision not in VALID_APPROVAL_DECISIONS:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {', '.join(sorted(VALID_APPROVAL_DECISIONS))}")

    tender = _get_org_tender(tender_id, membership, db)
    pending = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.tender_id == tender.id, ApprovalRequest.status == "pending")
        .order_by(ApprovalRequest.id.desc())
        .first()
    )
    if not pending:
        raise HTTPException(status_code=400, detail="This tender has no pending approval request.")

    pending.status = payload.decision
    pending.reviewer_user_id = membership.user_id
    pending.reviewer_note = payload.note.strip()
    pending.reviewed_at = datetime.utcnow()
    tender.approval_status = payload.decision
    if pending.requested_by_user_id != membership.user_id:
        _notify(
            db, membership.organization_id, pending.requested_by_user_id, "approval_decided",
            title=f'Tender "{tender.title}" was {payload.decision}',
            message=pending.reviewer_note,
            urgency="critical" if payload.decision == "rejected" else "info",
            entity_type="tender", entity_id=tender.id,
        )
    db.commit()
    return _approval_response(pending)


@router.get("/tenders/{tender_id}/approval/history")
def get_approval_history(
    tender_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    history = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.tender_id == tender.id)
        .order_by(ApprovalRequest.id.desc())
        .all()
    )
    return [_approval_response(a) for a in history]


@router.get("/approvals/pending")
def list_pending_approvals(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    pending = (
        db.query(ApprovalRequest)
        .filter(
            ApprovalRequest.organization_id == membership.organization_id,
            ApprovalRequest.status == "pending",
        )
        .order_by(ApprovalRequest.id.asc())
        .all()
    )
    tenders = {
        t.id: t
        for t in db.query(Tender).filter(Tender.id.in_([a.tender_id for a in pending])).all()
    }
    return [
        {
            **_approval_response(a),
            "tender_title": tenders[a.tender_id].title if a.tender_id in tenders else "",
        }
        for a in pending
    ]
