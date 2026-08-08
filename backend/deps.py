"""Shared dependencies, helpers, and the rate limiter used by every router.

This module must NOT import from main.py or from any router module — main.py
and the routers import from here to avoid circular imports.
"""

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
from datetime import datetime, timedelta
from io import BytesIO

from fastapi import Depends, Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import SessionLocal
from models import (
    Comment, Contract, Notification, OrgMembership, Organization,
    Task as TaskModel, Tender, User, Vendor,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx"}
TOKEN_TTL_DAYS = 30
PLAN_LIMITS = {"free": 5, "pro": -1, "business": -1}  # -1 = unlimited
VALID_ROLES = {"owner", "admin", "member"}
EMAIL_VERIFICATION_TTL_HOURS = 24
PASSWORD_RESET_TTL_HOURS = 1

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


def _rate_key(request: Request) -> str:
    if os.getenv("TESTING"):
        import uuid
        return str(uuid.uuid4())
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return f"user:{auth.split(' ', 1)[1].strip()}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_rate_key)

# ---------------------------------------------------------------------------
# DB session
# ---------------------------------------------------------------------------


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
    return f"{salt}${digest.hex()}"


def normalize_email(email: str) -> str:
    normalized = email.lower().strip()
    if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    return normalized


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, stored = password_hash.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
        return hmac.compare_digest(digest, stored)
    except ValueError:
        return False


def _token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=TOKEN_TTL_DAYS)


def auth_response(user: User, org: Organization) -> dict:
    return {
        "token": user.api_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "email_verified": bool(user.email_verified),
            "organization_name": org.name or "",
            "contact_name": user.contact_name or "",
            "phone": user.phone or "",
            "address": user.address or "",
            "plan": org.plan or "free",
        },
    }


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = authorization.split(" ", 1)[1].strip()
    user = db.query(User).filter(User.api_token == token).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    if user.token_expires_at and user.token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    user.token_expires_at = _token_expiry()
    db.commit()
    return user


def _get_org(organization_id: int, db: Session) -> Organization:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org


def _get_user_org(user: User, db: Session) -> Organization:
    # Most-recently-joined membership wins by default (see get_current_membership).
    membership = (
        db.query(OrgMembership)
        .filter(OrgMembership.user_id == user.id, OrgMembership.status == "active")
        .order_by(OrgMembership.id.desc())
        .first()
    )
    if not membership:
        raise HTTPException(status_code=500, detail="User has no organization membership.")
    return _get_org(membership.organization_id, db)


def get_current_membership(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_org_id: int | None = Header(default=None, alias="X-Org-Id"),
) -> OrgMembership:
    query = db.query(OrgMembership).filter(
        OrgMembership.user_id == current_user.id,
        OrgMembership.status == "active",
    )
    if x_org_id is not None:
        query = query.filter(OrgMembership.organization_id == x_org_id)
    # Every signup auto-creates a personal org, so an invited user ends up with
    # >1 membership; default to the most recently joined one (e.g. the team
    # they just accepted an invite into) until a frontend org-switcher exists.
    membership = query.order_by(OrgMembership.id.desc()).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No active organization membership.")
    return membership


def require_role(*roles: str):
    def _dep(membership: OrgMembership = Depends(get_current_membership)) -> OrgMembership:
        if membership.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return membership
    return _dep


def _can_modify_tender(tender: Tender, membership: OrgMembership) -> bool:
    return membership.role in ("owner", "admin") or tender.user_id == membership.user_id


def _get_org_tender(tender_id: int, membership: OrgMembership, db: Session) -> Tender:
    tender = db.query(Tender).filter(
        Tender.id == tender_id, Tender.organization_id == membership.organization_id
    ).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return tender


def _get_org_vendor(vendor_id: int, membership: OrgMembership, db: Session) -> Vendor:
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id, Vendor.organization_id == membership.organization_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return vendor

# ---------------------------------------------------------------------------
# Subscription / usage
# ---------------------------------------------------------------------------


def _reset_monthly_if_needed(org: Organization, db: Session) -> None:
    now = datetime.utcnow()
    if (
        org.monthly_reset_at is None
        or org.monthly_reset_at.month != now.month
        or org.monthly_reset_at.year != now.year
    ):
        org.monthly_tenders_used = 0
        org.monthly_reset_at = now
        db.commit()


def check_usage_limit(org: Organization, db: Session) -> None:
    _reset_monthly_if_needed(org, db)
    plan = org.plan or "free"
    limit = PLAN_LIMITS.get(plan, 5)
    if limit != -1 and (org.monthly_tenders_used or 0) >= limit:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Monthly limit reached ({limit} analyses/month on {plan.title()} plan). "
                "Upgrade to Pro (৳999/month) for unlimited analyses."
            ),
        )


def increment_usage(org: Organization, db: Session) -> None:
    org.monthly_tenders_used = (org.monthly_tenders_used or 0) + 1
    db.commit()

# ---------------------------------------------------------------------------
# Tender / file helpers
# ---------------------------------------------------------------------------


def _extract_bid_score(bid_recommendation: str | None) -> int | None:
    if not bid_recommendation:
        return None
    m = re.search(r"BID SCORE:\s*(\d+)", bid_recommendation, re.IGNORECASE)
    return max(0, min(100, int(m.group(1)))) if m else None


def extract_text_from_file(file_name: str, content: bytes) -> str:
    ext = os.path.splitext(file_name.lower())[1]
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload PDF, TXT, or DOCX.")

    if ext == ".pdf":
        try:
            import fitz
            pdf = fitz.open(stream=content, filetype="pdf")
            text = "".join(page.get_text() for page in pdf)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}")

        # Scanned PDFs have no embedded text layer, so PyMuPDF comes back
        # near-empty here. Fall back to Gemini vision OCR rather than silently
        # sending a blank document into analysis.
        if len(text.strip()) < 40 * max(1, pdf.page_count):
            try:
                from hermes_client import ocr_pdf_with_gemini
                ocr_text = ocr_pdf_with_gemini(content)
                if len(ocr_text.strip()) > len(text.strip()):
                    return ocr_text
            except Exception as exc:
                logger.warning("PDF OCR fallback failed: %s", exc)

        return text

    if ext == ".docx":
        try:
            from docx import Document
            doc = Document(BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read DOCX: {exc}")

    return content.decode("utf-8", errors="ignore")


def get_tender_response(tender: Tender) -> dict:
    return {
        "id": tender.id,
        "user_id": tender.user_id,
        "title": tender.title,
        "language": tender.language,
        "status": tender.status,
        "file_name": tender.file_name or "",
        "file_size": tender.file_size or 0,
        "deadline": tender.deadline,
        "bid_status": tender.bid_status or "reviewing",
        "bid_score": tender.bid_score,
        "notes": tender.notes or "",
        "approval_status": tender.approval_status or "none",
        "summary": tender.summary,
        "eligibility": tender.eligibility,
        "financial_requirements": tender.financial_requirements,
        "required_documents": tender.required_documents,
        "compliance_matrix": tender.compliance_matrix,
        "risk_analysis": tender.risk_analysis,
        "bid_recommendation": tender.bid_recommendation,
        "proposal_draft": tender.proposal_draft,
        "final_checklist": tender.final_checklist,
        "personalized_proposal": tender.personalized_proposal,
        "bid_strategy": tender.bid_strategy,
        "created_at": tender.created_at,
    }


def _company_profile(user: User, org: Organization) -> dict:
    return {
        "organization_name": org.name,
        "contact_name": user.contact_name,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
    }


def _get_knowledge_base(user: User) -> dict:
    try:
        return json.loads(user.knowledge_base or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _parse_deadline(deadline_str: str | None) -> datetime | None:
    if not deadline_str or not deadline_str.strip():
        return None
    try:
        return datetime.fromisoformat(deadline_str.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format. Use ISO-8601 (e.g. 2025-12-31).")


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"

# ---------------------------------------------------------------------------
# Organization member helpers
# ---------------------------------------------------------------------------


def _member_response(membership: OrgMembership, user: User | None) -> dict:
    return {
        "user_id": membership.user_id,
        "email": user.email if user else "",
        "contact_name": user.contact_name if user else "",
        "role": membership.role,
        "joined_at": membership.created_at,
    }


def _active_owner_count(organization_id: int, db: Session) -> int:
    return (
        db.query(OrgMembership)
        .filter(
            OrgMembership.organization_id == organization_id,
            OrgMembership.role == "owner",
            OrgMembership.status == "active",
        )
        .count()
    )

# ---------------------------------------------------------------------------
# Notifications (event-driven inserts — used by invite-accept, approvals,
# comments, and tasks, so this must live here rather than in one router)
# ---------------------------------------------------------------------------


def _notify(
    db: Session, organization_id: int, user_id: int, type: str,
    title: str, message: str = "", urgency: str = "info",
    entity_type: str | None = None, entity_id: int | None = None,
) -> None:
    db.add(Notification(
        organization_id=organization_id, user_id=user_id, type=type,
        entity_type=entity_type, entity_id=entity_id,
        title=title, message=message, urgency=urgency,
    ))


def _notify_admins(
    db: Session, organization_id: int, exclude_user_id: int, type: str,
    title: str, message: str = "", urgency: str = "info",
    entity_type: str | None = None, entity_id: int | None = None,
) -> None:
    admins = db.query(OrgMembership).filter(
        OrgMembership.organization_id == organization_id,
        OrgMembership.status == "active",
        OrgMembership.role.in_(("owner", "admin")),
        OrgMembership.user_id != exclude_user_id,
    ).all()
    for m in admins:
        _notify(db, organization_id, m.user_id, type, title, message, urgency, entity_type, entity_id)
