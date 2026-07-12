export type User = {
  id: number;
  email: string;
  organization_name: string;
  contact_name: string;
  phone: string;
  address: string;
  plan: "free" | "pro" | "business";
};

export type Subscription = {
  plan: "free" | "pro" | "business";
  monthly_tenders_used: number;
  monthly_limit: number;
  is_unlimited: boolean;
};

export type OrgRole = "owner" | "admin" | "member";

export type Organization = {
  id: number;
  name: string;
  plan: "free" | "pro" | "business";
  role: OrgRole;
};

export type OrgMember = {
  user_id: number;
  email: string;
  contact_name: string;
  role: OrgRole;
  joined_at: string;
};

export type OrgInvite = {
  id: number;
  email: string;
  role: OrgRole;
  token: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type PastProject = {
  id: string;
  name: string;
  client: string;
  value: string;
  year: string;
  duration: string;
  category: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  qualification: string;
  experience: string;
};

export type Equipment = {
  id: string;
  name: string;
  quantity: number;
  owned: boolean;
};

export type Certification = {
  id: string;
  name: string;
  number: string;
  expiry: string;
};

export type TurnoverEntry = {
  year: string;
  amount: string;
};

export type KnowledgeBase = {
  tin: string;
  bin: string;
  trade_license: string;
  trade_license_expiry: string;
  annual_turnover: TurnoverEntry[];
  past_projects: PastProject[];
  technical_team: TeamMember[];
  equipment: Equipment[];
  certifications: Certification[];
};

export const EMPTY_KB: KnowledgeBase = {
  tin: "",
  bin: "",
  trade_license: "",
  trade_license_expiry: "",
  annual_turnover: [
    { year: "2022-23", amount: "" },
    { year: "2023-24", amount: "" },
    { year: "2024-25", amount: "" },
  ],
  past_projects: [],
  technical_team: [],
  equipment: [],
  certifications: [],
};

export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";

export type ApprovalRequest = {
  id: number;
  tender_id: number;
  requested_by_user_id: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewer_user_id: number | null;
  reviewer_note: string;
  requested_at: string;
  reviewed_at: string | null;
};

export type Vendor = {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  rating: number | null;
  notes: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string | null;
};

export type ContractStatus = "draft" | "active" | "completed" | "terminated";

export type Contract = {
  id: number;
  tender_id: number | null;
  vendor_id: number | null;
  title: string;
  counterparty_name: string;
  contract_value: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: ContractStatus;
  performance_security: string;
  notes: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string | null;
};

export type TenderVendorLink = {
  link_id: number;
  role: string;
  notes: string;
  created_at: string;
  vendor: Vendor | null;
};

export type Comment = {
  id: number;
  entity_type: string;
  entity_id: number;
  author_user_id: number;
  author_email: string;
  body: string;
  created_at: string;
  updated_at: string | null;
};

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type Task = {
  id: number;
  entity_type: string | null;
  entity_id: number | null;
  title: string;
  description: string;
  assignee_user_id: number | null;
  assignee_email: string;
  created_by_user_id: number;
  created_by_email: string;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string | null;
};

export type TenderSummary = {
  id: number;
  user_id: number;
  title: string;
  language: string;
  status: string;
  file_name: string;
  file_size: number;
  deadline: string | null;
  bid_status: string;
  bid_score: number | null;
  approval_status: ApprovalStatus;
  created_at: string;
  summary: string;
};

export type TenderDetail = TenderSummary & {
  notes: string;
  eligibility: string | null;
  financial_requirements: string | null;
  required_documents: string | null;
  compliance_matrix: string | null;
  risk_analysis: string | null;
  bid_recommendation: string | null;
  proposal_draft: string | null;
  final_checklist: string | null;
  personalized_proposal: string | null;
  bid_strategy: string | null;
};

export type Urgency = "critical" | "warning" | "info";

export type CalendarEvent = {
  date: string;
  type: "tender_deadline" | "contract_end" | "task_due";
  entity_type: string | null;
  entity_id: number | null;
  title: string;
  urgency: Urgency;
};

export type AppNotification = {
  id: number | null;
  persisted: boolean;
  type: string;
  entity_type: string | null;
  entity_id: number | null;
  title: string;
  message: string;
  urgency: Urgency;
  read_at: string | null;
  created_at?: string;
  deadline?: string | null;
  days_left?: number | null;
};
