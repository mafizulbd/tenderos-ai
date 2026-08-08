import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import inspect, text

from database import Base, SessionLocal, engine
from deps import limiter
from models import OrgMembership, Organization, Tender, User
from routers import (
    approvals, auth, calendar, comments_tasks, contracts, discovery,
    documents, notifications, orgs, tenders, vendors,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TenderOS AI Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3008").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schema migration (additive, safe for existing databases)
# ---------------------------------------------------------------------------


def ensure_schema():
    inspector = inspect(engine)

    if inspector.has_table("users"):
        existing = {c["name"] for c in inspector.get_columns("users")}
        user_cols = {
            "token_expires_at":      "TIMESTAMP",
            "plan":                  "VARCHAR(20) DEFAULT 'free'",
            "monthly_tenders_used":  "INTEGER DEFAULT 0",
            "monthly_reset_at":      "TIMESTAMP",
            "knowledge_base":        "TEXT DEFAULT '{}'",
            "email_verified":                   "BOOLEAN DEFAULT FALSE",
            "email_verification_token":         "VARCHAR(255)",
            "email_verification_expires_at":    "TIMESTAMP",
            "password_reset_token":             "VARCHAR(255)",
            "password_reset_expires_at":         "TIMESTAMP",
        }
        with engine.begin() as conn:
            for col, defn in user_cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {defn}"))

    if not inspector.has_table("discovered_tenders"):
        Base.metadata.tables["discovered_tenders"].create(bind=engine)

    if not inspector.has_table("organizations"):
        Base.metadata.tables["organizations"].create(bind=engine)

    if not inspector.has_table("org_memberships"):
        Base.metadata.tables["org_memberships"].create(bind=engine)

    if not inspector.has_table("org_invites"):
        Base.metadata.tables["org_invites"].create(bind=engine)

    if not inspector.has_table("approval_requests"):
        Base.metadata.tables["approval_requests"].create(bind=engine)

    if not inspector.has_table("comments"):
        Base.metadata.tables["comments"].create(bind=engine)

    if not inspector.has_table("tasks"):
        Base.metadata.tables["tasks"].create(bind=engine)

    if not inspector.has_table("vendors"):
        Base.metadata.tables["vendors"].create(bind=engine)

    if not inspector.has_table("tender_vendor_links"):
        Base.metadata.tables["tender_vendor_links"].create(bind=engine)

    if not inspector.has_table("contracts"):
        Base.metadata.tables["contracts"].create(bind=engine)

    if not inspector.has_table("notifications"):
        Base.metadata.tables["notifications"].create(bind=engine)

    if inspector.has_table("tenders"):
        existing = {c["name"] for c in inspector.get_columns("tenders")}
        tender_cols = {
            "user_id":               "INTEGER",
            "organization_id":       "INTEGER",
            "status":                "VARCHAR(50) DEFAULT 'completed'",
            "file_name":             "VARCHAR(255) DEFAULT ''",
            "file_type":             "VARCHAR(100) DEFAULT ''",
            "file_size":             "INTEGER DEFAULT 0",
            "deadline":              "TIMESTAMP",
            "bid_status":            "VARCHAR(50) DEFAULT 'reviewing'",
            "bid_score":             "INTEGER",
            "notes":                 "TEXT DEFAULT ''",
            "approval_status":       "VARCHAR(20) DEFAULT 'none'",
            "financial_requirements":  "TEXT",
            "bid_recommendation":     "TEXT",
            "personalized_proposal":  "TEXT",
            "bid_strategy":           "TEXT",
        }
        with engine.begin() as conn:
            for col, defn in tender_cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tenders ADD COLUMN {col} {defn}"))

    _backfill_organizations()


def _backfill_organizations() -> None:
    """Give every user a personal Organization (idempotent, safe on every startup).

    New signups create their own org directly in the /auth/signup handler; this
    only exists to migrate users created before Organizations existed.
    """
    db = SessionLocal()
    try:
        for user in db.query(User).all():
            membership = (
                db.query(OrgMembership)
                .filter(OrgMembership.user_id == user.id)
                .order_by(OrgMembership.id.asc())
                .first()
            )
            if membership is None:
                org = Organization(
                    name=user.organization_name or f"{user.email}'s Organization",
                    plan=user.plan or "free",
                    monthly_tenders_used=user.monthly_tenders_used or 0,
                    monthly_reset_at=user.monthly_reset_at,
                )
                db.add(org)
                db.flush()
                db.add(OrgMembership(organization_id=org.id, user_id=user.id, role="owner"))
                db.commit()
                org_id = org.id
            else:
                org_id = membership.organization_id

            # Unconditional — cheap no-op once every tender has organization_id set,
            # and safe to re-run if a previous startup was interrupted mid-backfill.
            db.query(Tender).filter(
                Tender.user_id == user.id, Tender.organization_id.is_(None)
            ).update({"organization_id": org_id})
            db.commit()
    finally:
        db.close()


ensure_schema()

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(tenders.router)
app.include_router(approvals.router)
app.include_router(comments_tasks.router)
app.include_router(vendors.router)
app.include_router(contracts.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(calendar.router)
app.include_router(discovery.router)

# ---------------------------------------------------------------------------
# Background jobs
# ---------------------------------------------------------------------------

if not os.getenv("TESTING"):
    import scheduler as _scheduler_module

    @app.on_event("startup")
    def _start_scheduler():
        _scheduler_module.start_scheduler()

    @app.on_event("shutdown")
    def _stop_scheduler():
        _scheduler_module.stop_scheduler()
