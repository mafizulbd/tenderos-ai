from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime
from database import Base


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
