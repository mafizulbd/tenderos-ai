"""Contract tracking routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import _get_org_tender, _get_org_vendor, _parse_deadline, get_current_membership, get_db
from models import Contract, OrgMembership
from schemas import ContractCreate, ContractUpdate

router = APIRouter()

# ---------------------------------------------------------------------------
# Contract Tracking
# ---------------------------------------------------------------------------

VALID_CONTRACT_STATUSES = {"draft", "active", "completed", "terminated"}


def _can_modify_contract(contract: Contract, membership: OrgMembership) -> bool:
    return membership.role in ("owner", "admin") or contract.created_by_user_id == membership.user_id


def _contract_response(c: Contract) -> dict:
    return {
        "id": c.id,
        "tender_id": c.tender_id,
        "vendor_id": c.vendor_id,
        "title": c.title,
        "counterparty_name": c.counterparty_name or "",
        "contract_value": c.contract_value or "",
        "currency": c.currency or "BDT",
        "start_date": c.start_date,
        "end_date": c.end_date,
        "status": c.status or "draft",
        "performance_security": c.performance_security or "",
        "notes": c.notes or "",
        "created_by_user_id": c.created_by_user_id,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _get_org_contract(contract_id: int, membership: OrgMembership, db: Session) -> Contract:
    contract = db.query(Contract).filter(
        Contract.id == contract_id, Contract.organization_id == membership.organization_id
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return contract


@router.get("/contracts")
def list_contracts(
    status: str | None = None,
    vendor_id: int | None = None,
    tender_id: int | None = None,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    query = db.query(Contract).filter(Contract.organization_id == membership.organization_id)
    if status is not None:
        query = query.filter(Contract.status == status)
    if vendor_id is not None:
        query = query.filter(Contract.vendor_id == vendor_id)
    if tender_id is not None:
        query = query.filter(Contract.tender_id == tender_id)
    contracts = query.order_by(Contract.id.desc()).all()
    return [_contract_response(c) for c in contracts]


@router.post("/contracts")
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Contract title is required.")
    if payload.tender_id is not None:
        _get_org_tender(payload.tender_id, membership, db)
    if payload.vendor_id is not None:
        _get_org_vendor(payload.vendor_id, membership, db)

    contract = Contract(
        organization_id=membership.organization_id,
        tender_id=payload.tender_id,
        vendor_id=payload.vendor_id,
        title=title,
        counterparty_name=payload.counterparty_name.strip(),
        contract_value=payload.contract_value.strip(),
        currency=payload.currency.strip() or "BDT",
        start_date=_parse_deadline(payload.start_date),
        end_date=_parse_deadline(payload.end_date),
        status="draft",
        performance_security=payload.performance_security.strip(),
        notes=payload.notes,
        created_by_user_id=membership.user_id,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return _contract_response(contract)


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    return _contract_response(_get_org_contract(contract_id, membership, db))


@router.patch("/contracts/{contract_id}")
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    contract = _get_org_contract(contract_id, membership, db)
    if not _can_modify_contract(contract, membership):
        raise HTTPException(status_code=403, detail="You can only edit contracts you created.")

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Contract title is required.")
        contract.title = title
    if payload.tender_id is not None:
        _get_org_tender(payload.tender_id, membership, db)
        contract.tender_id = payload.tender_id
    if payload.vendor_id is not None:
        _get_org_vendor(payload.vendor_id, membership, db)
        contract.vendor_id = payload.vendor_id
    if payload.counterparty_name is not None:
        contract.counterparty_name = payload.counterparty_name.strip()
    if payload.contract_value is not None:
        contract.contract_value = payload.contract_value.strip()
    if payload.currency is not None:
        contract.currency = payload.currency.strip() or "BDT"
    if payload.start_date is not None:
        contract.start_date = _parse_deadline(payload.start_date)
    if payload.end_date is not None:
        contract.end_date = _parse_deadline(payload.end_date)
    if payload.status is not None:
        if payload.status not in VALID_CONTRACT_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_CONTRACT_STATUSES))}")
        contract.status = payload.status
    if payload.performance_security is not None:
        contract.performance_security = payload.performance_security.strip()
    if payload.notes is not None:
        contract.notes = payload.notes

    contract.updated_at = datetime.utcnow()
    db.commit()
    return _contract_response(contract)


@router.delete("/contracts/{contract_id}")
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    contract = _get_org_contract(contract_id, membership, db)
    if not _can_modify_contract(contract, membership):
        raise HTTPException(status_code=403, detail="You can only delete contracts you created.")

    db.delete(contract)
    db.commit()
    return {"detail": "Contract deleted."}
