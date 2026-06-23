from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from database import Base

class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)

    original_text = Column(Text)
    summary = Column(Text)
    eligibility = Column(Text)
    required_documents = Column(Text)
    compliance_matrix = Column(Text)
    risk_analysis = Column(Text)
    proposal_draft = Column(Text)
    final_checklist = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
