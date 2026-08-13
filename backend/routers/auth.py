"""Auth routes: health check, signup, login, current-user profile, knowledge base,
email verification, and password reset."""

import json
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from deps import (
    EMAIL_VERIFICATION_TTL_HOURS, PASSWORD_RESET_TTL_HOURS,
    _get_knowledge_base, _get_user_org, _token_expiry, auth_response,
    get_current_user, get_db, hash_password, limiter, normalize_email, verify_password,
)
from email_client import send_password_reset_email, send_verification_email
from models import Organization, OrgMembership, User
from schemas import (
    AuthRequest, ForgotPasswordRequest, KnowledgeBaseUpdate, ProfileUpdate,
    ResetPasswordRequest, VerifyEmailRequest,
)
from timeutils import utcnow

router = APIRouter()


@router.get("/")
def home():
    return {"status": "TenderOS backend running"}


@router.post("/auth/signup")
@limiter.limit("5/minute")
def signup(request: Request, payload: AuthRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    verification_token = secrets.token_urlsafe(32)
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        api_token=secrets.token_urlsafe(32),
        token_expires_at=_token_expiry(),
        plan="free",
        monthly_tenders_used=0,
        email_verified=False,
        email_verification_token=verification_token,
        email_verification_expires_at=utcnow() + timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS),
    )
    db.add(user)
    db.flush()

    org = Organization(name=f"{email}'s Organization", plan="free", monthly_tenders_used=0)
    db.add(org)
    db.flush()
    db.add(OrgMembership(organization_id=org.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(user)
    send_verification_email(user.email, verification_token)
    return auth_response(user, org)


@router.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, payload: AuthRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user.api_token = secrets.token_urlsafe(32)
    user.token_expires_at = _token_expiry()
    db.commit()
    db.refresh(user)
    return auth_response(user, _get_user_org(user, db))


@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return auth_response(current_user, _get_user_org(current_user, db))["user"]


@router.put("/me/profile")
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.contact_name = payload.contact_name.strip()
    current_user.phone = payload.phone.strip()
    current_user.address = payload.address.strip()
    db.commit()
    db.refresh(current_user)
    return auth_response(current_user, _get_user_org(current_user, db))["user"]


@router.get("/me/knowledge-base")
def get_knowledge_base(current_user: User = Depends(get_current_user)):
    return _get_knowledge_base(current_user)


@router.put("/me/knowledge-base")
def update_knowledge_base(
    payload: KnowledgeBaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.knowledge_base = json.dumps(payload.knowledge_base, ensure_ascii=False)
    db.commit()
    return {"detail": "Knowledge base updated.", "knowledge_base": payload.knowledge_base}

# ---------------------------------------------------------------------------
# Email verification / password reset
# ---------------------------------------------------------------------------


@router.post("/auth/verify-email")
@limiter.limit("10/minute")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    if user.email_verification_expires_at and user.email_verification_expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This verification link has expired. Request a new one.")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    db.commit()
    return {"detail": "Email verified."}


@router.post("/auth/resend-verification")
@limiter.limit("3/minute")
def resend_verification(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.email_verified:
        return {"detail": "Email already verified."}

    current_user.email_verification_token = secrets.token_urlsafe(32)
    current_user.email_verification_expires_at = utcnow() + timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS)
    db.commit()
    send_verification_email(current_user.email, current_user.email_verification_token)
    return {"detail": "Verification email sent."}


@router.post("/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always return the same response whether or not the email exists, to avoid
    # leaking which addresses have accounts.
    generic = {"detail": "If an account exists for this email, a password reset link has been sent."}
    try:
        email = normalize_email(payload.email)
    except HTTPException:
        return generic

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.password_reset_token = secrets.token_urlsafe(32)
        user.password_reset_expires_at = utcnow() + timedelta(hours=PASSWORD_RESET_TTL_HOURS)
        db.commit()
        send_password_reset_email(user.email, user.password_reset_token)
    return generic


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if user.password_reset_expires_at and user.password_reset_expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This reset link has expired. Request a new one.")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    # Rotate the session token too, so any existing sessions are invalidated.
    user.api_token = secrets.token_urlsafe(32)
    user.token_expires_at = _token_expiry()
    db.commit()
    return {"detail": "Password updated. You can now log in."}
