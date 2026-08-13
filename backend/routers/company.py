"""Structured company knowledge base: Personnel, Certifications, Project Experience.

Org-scoped (not user-scoped) so a whole team shares one company memory. These
replace the equivalent arrays that used to live only inside the freeform
User.knowledge_base JSON blob — see PROJECT_AUDIT.md. Equipment, annual
turnover, and registration basics (TIN/BIN/trade license) still live in that
blob via /me/knowledge-base; they weren't promoted to tables in this pass.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import (
    _can_modify_company_record, _get_org_certification, _get_org_personnel,
    _get_org_project, get_current_membership, get_db,
)
from models import Certification, OrgMembership, Personnel, ProjectExperience
from schemas import (
    CertificationCreate, CertificationUpdate, PersonnelCreate, PersonnelUpdate,
    ProjectExperienceCreate, ProjectExperienceUpdate,
)
from timeutils import utcnow

router = APIRouter(prefix="/company")

# ---------------------------------------------------------------------------
# Personnel
# ---------------------------------------------------------------------------


def _personnel_response(p: Personnel) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "role": p.role or "",
        "qualification": p.qualification or "",
        "experience": p.experience or "",
        "created_by_user_id": p.created_by_user_id,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("/personnel")
def list_personnel(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    rows = (
        db.query(Personnel).filter(Personnel.organization_id == membership.organization_id)
        .order_by(Personnel.id.asc()).all()
    )
    return [_personnel_response(p) for p in rows]


@router.post("/personnel")
def create_personnel(
    payload: PersonnelCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    row = Personnel(
        organization_id=membership.organization_id,
        name=name,
        role=payload.role.strip(),
        qualification=payload.qualification.strip(),
        experience=payload.experience.strip(),
        created_by_user_id=membership.user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _personnel_response(row)


@router.patch("/personnel/{personnel_id}")
def update_personnel(
    personnel_id: int,
    payload: PersonnelUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_personnel(personnel_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only edit records you created.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required.")
        row.name = name
    if payload.role is not None:
        row.role = payload.role.strip()
    if payload.qualification is not None:
        row.qualification = payload.qualification.strip()
    if payload.experience is not None:
        row.experience = payload.experience.strip()

    row.updated_at = utcnow()
    db.commit()
    return _personnel_response(row)


@router.delete("/personnel/{personnel_id}")
def delete_personnel(
    personnel_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_personnel(personnel_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only delete records you created.")
    db.delete(row)
    db.commit()
    return {"detail": "Personnel record deleted."}


# ---------------------------------------------------------------------------
# Certifications
# ---------------------------------------------------------------------------


def _certification_response(c: Certification) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "number": c.number or "",
        "expiry": c.expiry or "",
        "created_by_user_id": c.created_by_user_id,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("/certifications")
def list_certifications(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    rows = (
        db.query(Certification).filter(Certification.organization_id == membership.organization_id)
        .order_by(Certification.id.asc()).all()
    )
    return [_certification_response(c) for c in rows]


@router.post("/certifications")
def create_certification(
    payload: CertificationCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    row = Certification(
        organization_id=membership.organization_id,
        name=name,
        number=payload.number.strip(),
        expiry=payload.expiry.strip(),
        created_by_user_id=membership.user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _certification_response(row)


@router.patch("/certifications/{certification_id}")
def update_certification(
    certification_id: int,
    payload: CertificationUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_certification(certification_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only edit records you created.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required.")
        row.name = name
    if payload.number is not None:
        row.number = payload.number.strip()
    if payload.expiry is not None:
        row.expiry = payload.expiry.strip()

    row.updated_at = utcnow()
    db.commit()
    return _certification_response(row)


@router.delete("/certifications/{certification_id}")
def delete_certification(
    certification_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_certification(certification_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only delete records you created.")
    db.delete(row)
    db.commit()
    return {"detail": "Certification deleted."}


# ---------------------------------------------------------------------------
# Project Experience
# ---------------------------------------------------------------------------


def _project_response(p: ProjectExperience) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "client": p.client or "",
        "value": p.value or "",
        "year": p.year or "",
        "duration": p.duration or "",
        "category": p.category or "",
        "created_by_user_id": p.created_by_user_id,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("/projects")
def list_projects(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    rows = (
        db.query(ProjectExperience).filter(ProjectExperience.organization_id == membership.organization_id)
        .order_by(ProjectExperience.id.asc()).all()
    )
    return [_project_response(p) for p in rows]


@router.post("/projects")
def create_project(
    payload: ProjectExperienceCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required.")
    row = ProjectExperience(
        organization_id=membership.organization_id,
        name=name,
        client=payload.client.strip(),
        value=payload.value.strip(),
        year=payload.year.strip(),
        duration=payload.duration.strip(),
        category=payload.category.strip(),
        created_by_user_id=membership.user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _project_response(row)


@router.patch("/projects/{project_id}")
def update_project(
    project_id: int,
    payload: ProjectExperienceUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_project(project_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only edit records you created.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name is required.")
        row.name = name
    if payload.client is not None:
        row.client = payload.client.strip()
    if payload.value is not None:
        row.value = payload.value.strip()
    if payload.year is not None:
        row.year = payload.year.strip()
    if payload.duration is not None:
        row.duration = payload.duration.strip()
    if payload.category is not None:
        row.category = payload.category.strip()

    row.updated_at = utcnow()
    db.commit()
    return _project_response(row)


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    row = _get_org_project(project_id, membership, db)
    if not _can_modify_company_record(row, membership):
        raise HTTPException(status_code=403, detail="You can only delete records you created.")
    db.delete(row)
    db.commit()
    return {"detail": "Project experience record deleted."}
