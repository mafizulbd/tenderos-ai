"""Pydantic request models used across the API routers."""

from pydantic import BaseModel


class AuthRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    contact_name: str = ""
    phone: str = ""
    address: str = ""


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class OrgUpdate(BaseModel):
    name: str


class InviteCreate(BaseModel):
    email: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str


class ApprovalDecision(BaseModel):
    decision: str
    note: str = ""


class CommentCreate(BaseModel):
    entity_type: str
    entity_id: int
    body: str


class CommentUpdate(BaseModel):
    body: str


class TaskCreate(BaseModel):
    entity_type: str | None = None
    entity_id: int | None = None
    title: str
    description: str = ""
    assignee_user_id: int | None = None
    due_date: str | None = None  # ISO-8601 date string


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_user_id: int | None = None
    status: str | None = None
    due_date: str | None = None


class VendorCreate(BaseModel):
    name: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    category: str = ""
    rating: int | None = None
    notes: str = ""


class VendorUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    category: str | None = None
    rating: int | None = None
    notes: str | None = None


class VendorLinkCreate(BaseModel):
    vendor_id: int
    role: str = ""
    notes: str = ""


class ContractCreate(BaseModel):
    title: str
    tender_id: int | None = None
    vendor_id: int | None = None
    counterparty_name: str = ""
    contract_value: str = ""
    currency: str = "BDT"
    start_date: str | None = None
    end_date: str | None = None
    performance_security: str = ""
    notes: str = ""


class ContractUpdate(BaseModel):
    title: str | None = None
    tender_id: int | None = None
    vendor_id: int | None = None
    counterparty_name: str | None = None
    contract_value: str | None = None
    currency: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None
    performance_security: str | None = None
    notes: str | None = None


class ReanalyzeRequest(BaseModel):
    language: str = "english"


class TenderUpdate(BaseModel):
    bid_status: str | None = None
    notes: str | None = None
    deadline: str | None = None   # ISO-8601 date string or empty string to clear


class KnowledgeBaseUpdate(BaseModel):
    knowledge_base: dict = {}


class ProposalWizardRequest(BaseModel):
    language: str = "english"
    bid_price: str = ""
    timeline: str = ""
    warranty: str = "12 months"
    payment_terms: str = "Monthly progress payment"
    project_manager: str = ""
    methodology: str = ""
