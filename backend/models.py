from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, UniqueConstraint
from datetime import datetime
from database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="")

    plan = Column(String(20), default="free")           # free / pro / business
    monthly_tenders_used = Column(Integer, default=0)
    monthly_reset_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class OrgMembership(Base):
    __tablename__ = "org_memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_membership_org_user"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="member")     # owner / admin / member
    status = Column(String(20), nullable=False, default="active")   # active / removed
    created_at = Column(DateTime, default=datetime.utcnow)


class OrgInvite(Base):
    __tablename__ = "org_invites"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="member")
    token = Column(String(255), unique=True, nullable=False, index=True)
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending / accepted / revoked / expired
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    api_token = Column(String(255), unique=True, nullable=False, index=True)

    organization_name = Column(String(255), default="")
    contact_name = Column(String(255), default="")
    phone = Column(String(100), default="")
    address = Column(Text, default="")

    plan = Column(String(20), default="free")          # free / pro / business
    monthly_tenders_used = Column(Integer, default=0)
    monthly_reset_at = Column(DateTime, nullable=True)

    token_expires_at = Column(DateTime, nullable=True)
    knowledge_base = Column(Text, default="{}")   # JSON: past_projects, team, equipment, certs
    created_at = Column(DateTime, default=datetime.utcnow)


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=True)
    title = Column(String(255), nullable=False)
    language = Column(String(50), default="english")
    status = Column(String(50), default="completed")   # completed / failed

    file_name = Column(String(255), default="")
    file_type = Column(String(100), default="")
    file_size = Column(Integer, default=0)

    # Lifecycle
    deadline = Column(DateTime, nullable=True)
    bid_status = Column(String(50), default="reviewing")  # reviewing/submitted/won/lost/no-bid
    bid_score = Column(Integer, nullable=True)             # 0-100, AI-generated
    notes = Column(Text, default="")
    approval_status = Column(String(20), default="none")   # none/pending/approved/rejected — denormalized cache

    # AI analysis sections
    original_text = Column(Text)
    summary = Column(Text)
    eligibility = Column(Text)
    financial_requirements = Column(Text)
    required_documents = Column(Text)
    compliance_matrix = Column(Text)
    risk_analysis = Column(Text)
    bid_recommendation = Column(Text)
    proposal_draft = Column(Text)
    final_checklist = Column(Text)
    personalized_proposal = Column(Text)   # AI-generated full proposal using company KB
    bid_strategy = Column(Text)             # AI bid strategy + compliance + risk heatmap

    created_at = Column(DateTime, default=datetime.utcnow)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending/approved/rejected/cancelled
    reviewer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_note = Column(Text, default="")
    requested_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class DiscoveredTender(Base):
    """Global pool of tenders discovered from external sources."""
    __tablename__ = "discovered_tenders"

    id              = Column(Integer, primary_key=True, index=True)
    source          = Column(String(100))
    external_id     = Column(String(255), unique=True, index=True)
    title           = Column(String(500))
    description     = Column(Text, default="")
    category        = Column(String(300), default="")
    deadline        = Column(DateTime, nullable=True)
    estimated_value = Column(String(200), default="")
    url             = Column(String(500), default="")
    country         = Column(String(100), default="Bangladesh")
    discovered_at   = Column(DateTime, default=datetime.utcnow)
