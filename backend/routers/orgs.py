"""Organization / team routes: org profile, members, invites, subscription."""

import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from deps import (
    PLAN_LIMITS, VALID_ROLES, _active_owner_count, _get_org, _member_response,
    _notify, _reset_monthly_if_needed, get_current_membership, get_current_user,
    get_db, limiter, normalize_email, require_role,
)
from models import OrgInvite, OrgMembership, User
from schemas import InviteCreate, MemberRoleUpdate, OrgUpdate
from timeutils import utcnow

router = APIRouter()

# ---------------------------------------------------------------------------
# Organizations / Teams
# ---------------------------------------------------------------------------


@router.get("/orgs/me")
def get_my_org(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    org = _get_org(membership.organization_id, db)
    return {"id": org.id, "name": org.name, "plan": org.plan or "free", "role": membership.role}


@router.put("/orgs/me")
def update_my_org(
    payload: OrgUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner")),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Organization name is required.")
    org = _get_org(membership.organization_id, db)
    org.name = name
    db.commit()
    return {"id": org.id, "name": org.name, "plan": org.plan or "free", "role": membership.role}


@router.get("/orgs/me/members")
def list_members(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    memberships = (
        db.query(OrgMembership)
        .filter(
            OrgMembership.organization_id == membership.organization_id,
            OrgMembership.status == "active",
        )
        .order_by(OrgMembership.id.asc())
        .all()
    )
    users = {
        u.id: u
        for u in db.query(User).filter(User.id.in_([m.user_id for m in memberships])).all()
    }
    return [_member_response(m, users.get(m.user_id)) for m in memberships]


@router.patch("/orgs/me/members/{user_id}")
def update_member_role(
    user_id: int,
    payload: MemberRoleUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")

    target = db.query(OrgMembership).filter(
        OrgMembership.organization_id == membership.organization_id,
        OrgMembership.user_id == user_id,
        OrgMembership.status == "active",
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    if target.role == "owner" and payload.role != "owner" and _active_owner_count(membership.organization_id, db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot demote the sole remaining owner.")

    target.role = payload.role
    db.commit()
    return _member_response(target, db.query(User).filter(User.id == user_id).first())


@router.delete("/orgs/me/members/{user_id}")
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    if user_id == membership.user_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself from the organization.")

    target = db.query(OrgMembership).filter(
        OrgMembership.organization_id == membership.organization_id,
        OrgMembership.user_id == user_id,
        OrgMembership.status == "active",
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    if target.role == "owner" and _active_owner_count(membership.organization_id, db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the sole remaining owner.")
    if membership.role == "admin" and target.role in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admins cannot remove owners or other admins.")

    target.status = "removed"
    db.commit()
    return {"detail": "Member removed."}


@router.post("/orgs/me/invites")
@limiter.limit("10/minute")
def create_invite(
    request: Request,
    payload: InviteCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")
    email = normalize_email(payload.email)

    already_member = (
        db.query(OrgMembership)
        .join(User, User.id == OrgMembership.user_id)
        .filter(
            OrgMembership.organization_id == membership.organization_id,
            OrgMembership.status == "active",
            User.email == email,
        )
        .first()
    )
    if already_member:
        raise HTTPException(status_code=409, detail="This person is already a member of your organization.")

    invite = OrgInvite(
        organization_id=membership.organization_id,
        email=email,
        role=payload.role,
        token=secrets.token_urlsafe(24),
        invited_by_user_id=membership.user_id,
        status="pending",
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {
        "id": invite.id, "email": invite.email, "role": invite.role, "token": invite.token,
        "status": invite.status, "expires_at": invite.expires_at, "created_at": invite.created_at,
    }


@router.get("/orgs/me/invites")
def list_invites(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    invites = (
        db.query(OrgInvite)
        .filter(OrgInvite.organization_id == membership.organization_id, OrgInvite.status == "pending")
        .order_by(OrgInvite.id.desc())
        .all()
    )
    return [
        {
            "id": i.id, "email": i.email, "role": i.role, "token": i.token,
            "status": i.status, "expires_at": i.expires_at, "created_at": i.created_at,
        }
        for i in invites
    ]


@router.delete("/orgs/me/invites/{invite_id}")
def revoke_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(require_role("owner", "admin")),
):
    invite = db.query(OrgInvite).filter(
        OrgInvite.id == invite_id, OrgInvite.organization_id == membership.organization_id
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    invite.status = "revoked"
    db.commit()
    return {"detail": "Invite revoked."}


@router.post("/invites/{token}/accept")
def accept_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite = db.query(OrgInvite).filter(OrgInvite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="This invite is no longer valid.")
    if invite.expires_at and invite.expires_at < utcnow():
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="This invite has expired.")
    if invite.email != current_user.email:
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address.")

    existing = db.query(OrgMembership).filter(
        OrgMembership.organization_id == invite.organization_id,
        OrgMembership.user_id == current_user.id,
    ).first()
    if existing:
        existing.status = "active"
        existing.role = invite.role
    else:
        db.add(OrgMembership(
            organization_id=invite.organization_id,
            user_id=current_user.id,
            role=invite.role,
            status="active",
        ))

    invite.status = "accepted"
    _notify(
        db, invite.organization_id, invite.invited_by_user_id, "member_invited",
        title=f"{current_user.email} accepted your invite",
        entity_type=None, entity_id=None,
    )
    db.commit()
    org = _get_org(invite.organization_id, db)
    return {"detail": "Invite accepted.", "organization": {"id": org.id, "name": org.name}}

# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------


@router.get("/subscription")
def get_subscription(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    org = _get_org(membership.organization_id, db)
    _reset_monthly_if_needed(org, db)
    plan = org.plan or "free"
    limit = PLAN_LIMITS.get(plan, 5)
    return {
        "plan": plan,
        "monthly_tenders_used": org.monthly_tenders_used or 0,
        "monthly_limit": limit,
        "is_unlimited": limit == -1,
    }
