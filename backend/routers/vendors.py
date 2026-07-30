"""Vendor management routes, plus tender <-> vendor linking."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from deps import (
    _can_modify_tender, _get_org_tender, _get_org_vendor, get_current_membership, get_db,
)
from models import OrgMembership, TenderVendorLink, Vendor
from schemas import VendorCreate, VendorLinkCreate, VendorUpdate

router = APIRouter()

# ---------------------------------------------------------------------------
# Vendor Management
# ---------------------------------------------------------------------------


def _can_modify_vendor(vendor: Vendor, membership: OrgMembership) -> bool:
    return membership.role in ("owner", "admin") or vendor.created_by_user_id == membership.user_id


def _vendor_response(v: Vendor) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "contact_name": v.contact_name or "",
        "email": v.email or "",
        "phone": v.phone or "",
        "address": v.address or "",
        "category": v.category or "",
        "rating": v.rating,
        "notes": v.notes or "",
        "created_by_user_id": v.created_by_user_id,
        "created_at": v.created_at,
        "updated_at": v.updated_at,
    }


@router.get("/vendors")
def list_vendors(
    search: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    query = db.query(Vendor).filter(Vendor.organization_id == membership.organization_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Vendor.name.ilike(term), Vendor.contact_name.ilike(term)))
    if category.strip():
        query = query.filter(Vendor.category == category.strip())
    vendors = query.order_by(Vendor.name.asc()).all()
    return [_vendor_response(v) for v in vendors]


@router.post("/vendors")
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Vendor name is required.")

    vendor = Vendor(
        organization_id=membership.organization_id,
        name=name,
        contact_name=payload.contact_name.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip(),
        address=payload.address.strip(),
        category=payload.category.strip(),
        rating=payload.rating,
        notes=payload.notes,
        created_by_user_id=membership.user_id,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return _vendor_response(vendor)


@router.get("/vendors/{vendor_id}")
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    return _vendor_response(_get_org_vendor(vendor_id, membership, db))


@router.patch("/vendors/{vendor_id}")
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    vendor = _get_org_vendor(vendor_id, membership, db)
    if not _can_modify_vendor(vendor, membership):
        raise HTTPException(status_code=403, detail="You can only edit vendors you created.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Vendor name is required.")
        vendor.name = name
    if payload.contact_name is not None:
        vendor.contact_name = payload.contact_name.strip()
    if payload.email is not None:
        vendor.email = payload.email.strip()
    if payload.phone is not None:
        vendor.phone = payload.phone.strip()
    if payload.address is not None:
        vendor.address = payload.address.strip()
    if payload.category is not None:
        vendor.category = payload.category.strip()
    if payload.rating is not None:
        vendor.rating = payload.rating
    if payload.notes is not None:
        vendor.notes = payload.notes

    vendor.updated_at = datetime.utcnow()
    db.commit()
    return _vendor_response(vendor)


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    vendor = _get_org_vendor(vendor_id, membership, db)
    if not _can_modify_vendor(vendor, membership):
        raise HTTPException(status_code=403, detail="You can only delete vendors you created.")

    db.delete(vendor)
    db.commit()
    return {"detail": "Vendor deleted."}


@router.get("/tenders/{tender_id}/vendors")
def list_tender_vendors(
    tender_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    links = db.query(TenderVendorLink).filter(TenderVendorLink.tender_id == tender.id).all()
    vendors = {v.id: v for v in db.query(Vendor).filter(Vendor.id.in_([l.vendor_id for l in links])).all()}
    return [
        {
            "link_id": link.id,
            "role": link.role or "",
            "notes": link.notes or "",
            "created_at": link.created_at,
            "vendor": _vendor_response(vendors[link.vendor_id]) if link.vendor_id in vendors else None,
        }
        for link in links
    ]


@router.post("/tenders/{tender_id}/vendors")
def link_tender_vendor(
    tender_id: int,
    payload: VendorLinkCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    if not _can_modify_tender(tender, membership):
        raise HTTPException(status_code=403, detail="You can only link vendors to tenders you created.")
    _get_org_vendor(payload.vendor_id, membership, db)

    existing = db.query(TenderVendorLink).filter(
        TenderVendorLink.tender_id == tender.id, TenderVendorLink.vendor_id == payload.vendor_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This vendor is already linked to this tender.")

    link = TenderVendorLink(
        tender_id=tender.id, vendor_id=payload.vendor_id, role=payload.role, notes=payload.notes,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    vendor = _get_org_vendor(payload.vendor_id, membership, db)
    return {
        "link_id": link.id, "role": link.role or "", "notes": link.notes or "",
        "created_at": link.created_at, "vendor": _vendor_response(vendor),
    }


@router.delete("/tenders/{tender_id}/vendors/{vendor_id}")
def unlink_tender_vendor(
    tender_id: int,
    vendor_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tender = _get_org_tender(tender_id, membership, db)
    if not _can_modify_tender(tender, membership):
        raise HTTPException(status_code=403, detail="You can only unlink vendors from tenders you created.")

    link = db.query(TenderVendorLink).filter(
        TenderVendorLink.tender_id == tender.id, TenderVendorLink.vendor_id == vendor_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="This vendor is not linked to this tender.")

    db.delete(link)
    db.commit()
    return {"detail": "Vendor unlinked."}
