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

export type TenderSummary = {
  id: number;
  title: string;
  language: string;
  status: string;
  file_name: string;
  file_size: number;
  deadline: string | null;
  bid_status: string;
  bid_score: number | null;
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
