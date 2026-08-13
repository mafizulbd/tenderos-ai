"""Gemini AI wrapper for tender analysis."""

import os
import re
import time
import logging
from io import BytesIO

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_MODEL = "gemini-2.5-flash"


def _client() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Critical: client lifetime. Always bind `client = _client()` to a local
# variable BEFORE calling anything on it — never chain `_client().models...`
# inline. CPython drops the temporary Client's last reference as soon as the
# `.models` attribute access completes (before the call it's chained into
# runs), which closes its underlying httpx transport mid-request and raises
# "Cannot send a request, as the client has been closed." This bites both
# streaming (`generate_content_stream`, a lazy iterator) and, contrary to an
# earlier assumption recorded in project history, ordinary non-streaming
# `generate_content` calls too — reproduced live against the real Gemini API
# on the `generate_kb_gap_questions`/`validate_document` inline-call pattern.

# Section order MUST match the prompt headings exactly — parser depends on this.
_SECTIONS = [
    ("summary",                r"### Executive Summary",              r"### Eligibility Criteria"),
    ("eligibility",            r"### Eligibility Criteria",           r"### Financial Requirements"),
    ("financial_requirements", r"### Financial Requirements",         r"### Required Documents"),
    ("required_documents",     r"### Required Documents",             r"### Compliance Matrix"),
    ("compliance_matrix",      r"### Compliance Matrix",              r"### Risk Analysis"),
    ("risk_analysis",          r"### Risk Analysis",                  r"### Bid Recommendation"),
    ("bid_recommendation",     r"### Bid Recommendation",             r"### Tender Submission Draft"),
    ("proposal_draft",         r"### Tender Submission Draft",        r"### Final Submission Checklist"),
    ("final_checklist",        r"### Final Submission Checklist",     None),
]

_LANG_INSTRUCTION = {
    "english": "Respond entirely in English.",
    "bangla": (
        "Respond entirely in Bengali (Bangla / বাংলা). "
        "Use formal Bengali suitable for government and business contexts. "
        "Keep section headings (### ...) in English for parser stability."
    ),
}

_BD_CONTEXT = """
BANGLADESH PROCUREMENT CONTEXT:
- Government procurement: Public Procurement Act 2006 (PPA 2006), Public Procurement Rules 2008 (PPR 2008).
- Oversight: Central Procurement Technical Unit (CPTU) under IMED, Ministry of Planning.
- e-GP system: eprocure.gov.bd — mandatory for government tenders above threshold.
- Key procuring entities: LGED, RHD, BWDB, RAJUK, PWD, BREB, DESCO, DWASA, City Corporations, Ministries.
- Procurement methods: OTM (Open Tendering Method), LTM (Limited Tendering Method), DPM (Direct Procurement), RFQ.
- Key documents: IFB (Invitation for Bids), SBD (Standard Bidding Documents), BOQ (Bill of Quantities).
- NGO/donor procurement: World Bank (STEP), ADB, UNDP, USAID, EU, FCDO/DFID guidelines apply.
- Eligibility documents: Trade License, TIN, VAT/BIN, IRC/ERC (import/export), experience certificates, bank solvency.
- Financial instruments: Bid Security/EMD (1-2% of bid value), Performance Security (10% of contract), Advance Payment Guarantee.
- Currency: BDT (Taka, ৳).
- Bid evaluation: LNRB (Lowest Negotiated Responsive Bid), post-qualification, technical-then-financial two-envelope.
"""

_EMPTY_RESULT: dict = {k: None for k, *_ in _SECTIONS}


def _build_prompt(text: str, language: str, company_profile: dict | None = None) -> str:
    lang_instr = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["english"])

    profile_text = "No bidder profile provided."
    if company_profile:
        lines = [
            f"- {label}: {val}"
            for label, key in [
                ("Organization", "organization_name"),
                ("Contact",      "contact_name"),
                ("Email",        "email"),
                ("Phone",        "phone"),
                ("Address",      "address"),
            ]
            if (val := company_profile.get(key))
        ]
        if lines:
            profile_text = "\n".join(lines)

    return f"""You are TenderOS — an expert Bangladesh procurement and tender analysis AI.

{_BD_CONTEXT}

LANGUAGE: {lang_instr}
RULES:
- Use only information found in the provided tender document.
- Do not invent figures, experience, certificates, or personnel.
- Keep ### headings exactly as shown — they are parsed programmatically.
- Write with formal, professional language appropriate for Bangladesh procurement context.

Bidder Profile (use only in proposal draft):
{profile_text}

Analyze the tender document below. Produce output with EXACTLY these sections in order:

### Executive Summary
3-5 paragraphs: tender purpose, issuing entity, sector (Government/NGO/Private), procurement method, estimated value (if stated), submission deadline, bid opening date, contract duration, whether on e-GP or physical submission.

### Eligibility Criteria
All bidder eligibility requirements: legal registration, nationality, past experience (years/project count/minimum contract value), financial standing, blacklisting clauses, JV/consortium rules. Flag unusually restrictive conditions.

### Financial Requirements
All financial criteria and instruments:
- Minimum annual turnover / average revenue
- Bid Security / EMD: amount (৳), form (bank guarantee/payorder/DD), issuing bank requirements, validity
- Performance Security: percentage, timeline, conditions
- Working capital / net worth thresholds
- Advance payment terms
- Bank solvency certificate requirements
Note all amounts in BDT (৳) and foreign currency equivalents if stated.

### Required Documents
Complete document list grouped by category (Legal, Financial, Technical, Experience). Mark each: M = Mandatory, C = Conditional. Include copy count, notarization, and attestation requirements.

### Compliance Matrix
| Requirement | Clause/Ref | Status | Action Required |
|---|---|---|---|
(Rows for every key requirement. Status: COMPLIANT / NEEDS-ACTION / GAP)

### Risk Analysis
At least 6 risks across: Technical, Financial, Legal/Compliance, Operational, and Bangladesh-specific (political calendar, monsoon/disaster, e-GP system, payment delay). For each: Severity (HIGH/MEDIUM/LOW), Likelihood, Mitigation.

### Bid Recommendation
IMPORTANT — start with exactly these two lines (no blank line between):
BID SCORE: [integer 0-100]
BID DECISION: [RECOMMENDED / CONDITIONAL / NOT RECOMMENDED]

Scoring: 80-100 strong fit, 60-79 viable with prep, 40-59 significant gaps, 0-39 not viable.

Then:
1. Strategic Assessment (capability alignment)
2. Key Strengths
3. Critical Gaps (must resolve before bidding)
4. Pre-bid Action Plan (e-GP registration, document checklist, sub-contractors, timeline)
5. Win Probability and competitive landscape

### Tender Submission Draft
Professional bid cover letter and technical proposal introduction for Bangladesh submission context. Include IFB/SBD reference if known, standard formalities, compliance commitments per PPA 2006 / donor guidelines. Use placeholders [Company Name], [Date] where unknown. Ready-to-edit format.

### Final Submission Checklist
Numbered checklist covering: document preparation tasks, e-GP vs physical submission steps, key deadlines, bid security procurement, submission attendance and post-submission actions.

TENDER DOCUMENT:
{text[:18000]}
"""


def parse_gemini_response(text: str) -> dict:
    result = dict(_EMPTY_RESULT)
    for key, start_pattern, end_pattern in _SECTIONS:
        start_match = re.search(start_pattern, text, re.MULTILINE)
        if not start_match:
            continue
        content_start = start_match.end()
        if end_pattern:
            end_match = re.search(end_pattern, text[content_start:], re.MULTILINE)
            content = (
                text[content_start: content_start + end_match.start()]
                if end_match
                else text[content_start:]
            )
        else:
            content = text[content_start:]
        result[key] = content.strip()
    return result


def stream_with_gemini(text: str, language: str, company_profile: dict | None = None):
    """Synchronous generator yielding text chunks from Gemini streaming API."""
    prompt = _build_prompt(text, language, company_profile)
    # The client must be held in a variable for the generator's lifetime — an
    # inline `_client()` here gets garbage-collected (closing its underlying
    # HTTP client) before the lazy stream is actually consumed.
    client = _client()
    for chunk in client.models.generate_content_stream(model=_MODEL, contents=prompt):
        if getattr(chunk, "text", None):
            yield chunk.text


def analyze_with_gemini(
    text: str,
    language: str = "english",
    company_profile: dict | None = None,
) -> dict:
    """Full analysis with 3-attempt exponential-backoff retry."""
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            full_text = "".join(stream_with_gemini(text, language, company_profile))
            return parse_gemini_response(full_text)
        except Exception as exc:
            last_error = exc
            logger.warning("Gemini attempt %d failed: %s", attempt + 1, exc)
            time.sleep(2 ** attempt)

    err = f"Gemini API Error after 3 attempts: {last_error}"
    return {k: (err if k == "summary" else "Not generated") for k in _EMPTY_RESULT}


# ---------------------------------------------------------------------------
# Knowledge Base Gap Questions
#
# Tender-triggered elicitation: after analysis, compare THIS tender's
# requirements against what's already in the org's Knowledge Base and ask
# only for what's missing or relevant — rather than a generic upfront form.
# ---------------------------------------------------------------------------

_KB_GAP_CATEGORIES = ("certifications", "personnel", "projects", "basics", "equipment", "other")


def _build_kb_gap_prompt(tender_analysis: dict, company_kb: dict, language: str = "english") -> str:
    lang_instr = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["english"])

    projects_text = "".join(
        f"\n  - {p.get('name','—')} ({p.get('category','—')}, {p.get('year','—')})"
        for p in company_kb.get("past_projects", [])
    ) or " None on file."

    team_text = "".join(
        f"\n  - {m.get('name','—')} — {m.get('role','—')}"
        for m in company_kb.get("technical_team", [])
    ) or " None on file."

    certs_text = "".join(
        f"\n  - {c.get('name','—')} (expires {c.get('expiry','—')})"
        for c in company_kb.get("certifications", [])
    ) or " None on file."

    equipment_text = "".join(
        f"\n  - {e.get('name','—')} × {e.get('quantity',1)}"
        for e in company_kb.get("equipment", [])
    ) or " None on file."

    return f"""You are TenderOS — an AI procurement analyst helping a Bangladeshi bidder
check whether their Company Knowledge Base has what THIS SPECIFIC tender needs.

{_BD_CONTEXT}

LANGUAGE: {lang_instr}

CRITICAL RULES:
- Only ask about things this tender's eligibility/documents/compliance sections actually require or reference. Do not ask generic company-profile questions unrelated to this tender.
- Only flag something as a gap if it is genuinely missing, unclear, or thin in the Knowledge Base below — do not flag something already present just because it could have more detail.
- Never assume the company has something not listed in the Knowledge Base. Absence of a certification/project/team member in the KB means the user must be asked, not that it's safe to assume they have it.
- If the Knowledge Base already appears to fully cover this tender's requirements, output zero questions rather than inventing filler ones.
- Output MUST follow the exact machine-parsed format below. Valid CATEGORY values: {", ".join(_KB_GAP_CATEGORIES)}.

═══ TENDER REQUIREMENTS ═══
Eligibility Criteria:
{(tender_analysis.get('eligibility') or '')[:1200]}

Required Documents:
{(tender_analysis.get('required_documents') or '')[:800]}

Compliance Matrix:
{(tender_analysis.get('compliance_matrix') or '')[:800]}

═══ CURRENT COMPANY KNOWLEDGE BASE ═══
Registration basics (TIN/BIN/trade license): {"On file." if company_kb.get('tin') or company_kb.get('trade_license') else "Not on file."}
Certifications:{certs_text}
Past Projects:{projects_text}
Technical Team:{team_text}
Equipment:{equipment_text}

═══ REQUIRED OUTPUT (machine-parsed — one question per 3 lines, exact labels) ═══
For each gap, output exactly:
CATEGORY: [one of: {", ".join(_KB_GAP_CATEGORIES)}]
QUESTION: [a specific, answerable question referencing what the tender requires]
---
(repeat the CATEGORY/QUESTION/--- block for each gap; output nothing else if there are no gaps)
"""


def generate_kb_gap_questions(tender_analysis: dict, company_kb: dict, language: str = "english") -> list[dict]:
    """Non-streaming — this is a short, structured output, not a long document."""
    prompt = _build_kb_gap_prompt(tender_analysis, company_kb, language)
    client = _client()  # bind first — see the "Critical: client lifetime" note near _client()
    response = client.models.generate_content(model=_MODEL, contents=prompt)
    raw = response.text if hasattr(response, "text") else ""
    return _parse_kb_gap_questions(raw)


def _parse_kb_gap_questions(text: str) -> list[dict]:
    questions = []
    for block in text.split("---"):
        category_match = re.search(r"CATEGORY:\s*(\w+)", block, re.IGNORECASE)
        question_match = re.search(r"QUESTION:\s*(.+?)(?:\n|$)", block, re.IGNORECASE)
        if not (category_match and question_match):
            continue
        category = category_match.group(1).strip().lower()
        if category not in _KB_GAP_CATEGORIES:
            category = "other"
        question = question_match.group(1).strip()
        if question:
            questions.append({"category": category, "question": question})
    return questions


# ---------------------------------------------------------------------------
# Personalized Proposal Generator
# ---------------------------------------------------------------------------

def _build_proposal_prompt(
    tender_analysis: dict,
    company_kb: dict,
    wizard_data: dict,
    language: str = "english",
) -> str:
    lang_instr = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["english"])

    # Format knowledge base sections
    projects_text = ""
    for i, p in enumerate(company_kb.get("past_projects", []), 1):
        projects_text += (
            f"\n  {i}. {p.get('name','—')} | Client: {p.get('client','—')} "
            f"| Value: {p.get('value','—')} | Year: {p.get('year','—')} "
            f"| Duration: {p.get('duration','—')} | Category: {p.get('category','—')}"
        )

    team_text = ""
    for m in company_kb.get("technical_team", []):
        team_text += (
            f"\n  - {m.get('name','—')} | {m.get('role','—')} "
            f"| {m.get('qualification','—')} | {m.get('experience','—')} exp."
        )

    equipment_text = ""
    for e in company_kb.get("equipment", []):
        owned = "Owned" if e.get("owned") else "Rented"
        equipment_text += f"\n  - {e.get('name','—')} × {e.get('quantity',1)} ({owned})"

    certs_text = ""
    for c in company_kb.get("certifications", []):
        certs_text += f"\n  - {c.get('name','—')} | No: {c.get('number','—')} | Expires: {c.get('expiry','—')}"

    turnover_text = ""
    for t in company_kb.get("annual_turnover", []):
        turnover_text += f"\n  - {t.get('year','—')}: {t.get('amount','—')}"

    return f"""You are TenderOS — an expert AI Procurement Proposal Writer for Bangladesh.

{_BD_CONTEXT}

LANGUAGE: {lang_instr}

Generate a COMPLETE, PROFESSIONAL, SUBMISSION-READY tender proposal document.

═══ TENDER ANALYSIS CONTEXT ═══
Summary: {(tender_analysis.get('summary') or '')[:1200]}

Eligibility Requirements:
{(tender_analysis.get('eligibility') or '')[:800]}

Financial Requirements:
{(tender_analysis.get('financial_requirements') or '')[:600]}

Required Documents:
{(tender_analysis.get('required_documents') or '')[:600]}

Compliance Issues:
{(tender_analysis.get('compliance_matrix') or '')[:600]}

Risk Analysis:
{(tender_analysis.get('risk_analysis') or '')[:600]}

═══ COMPANY KNOWLEDGE BASE ═══
Company: {company_kb.get('company_name', wizard_data.get('company_name', '[Company Name]'))}
TIN: {company_kb.get('tin', '[TIN]')}
BIN/VAT: {company_kb.get('bin', '[BIN]')}
Trade License: {company_kb.get('trade_license', '[TL No.]')} (Expires: {company_kb.get('trade_license_expiry', '—')})
Address: {company_kb.get('address', wizard_data.get('address', '[Address]'))}
Contact: {company_kb.get('contact_name', wizard_data.get('contact_name', '[Contact]'))} | {company_kb.get('phone', wizard_data.get('phone', '[Phone]'))}

Annual Turnover:{turnover_text or ' Not specified'}

Past Projects:{projects_text or ' No past projects provided'}

Technical Team:{team_text or ' Not specified'}

Equipment:{equipment_text or ' Not specified'}

Certifications:{certs_text or ' None listed'}

═══ BID-SPECIFIC INPUTS ═══
Proposed Bid Price: BDT {wizard_data.get('bid_price', '[To be determined]')}
Proposed Completion Time: {wizard_data.get('timeline', '[To be determined]')}
Warranty Period: {wizard_data.get('warranty', '12 months')}
Payment Terms Preference: {wizard_data.get('payment_terms', 'Monthly progress payment')}
Project Manager: {wizard_data.get('project_manager', '[Project Manager Name]')}
Additional Notes: {wizard_data.get('methodology', '')}

═══ INSTRUCTIONS ═══
Generate a complete, formal, submission-ready proposal with ALL of these numbered sections.
Use placeholder text like [TO BE FILLED] for any unknown specific details.
Write in formal, professional language appropriate for Bangladesh government/NGO procurement.

## 1. COVER LETTER
Formal cover letter on company letterhead format. Include IFB reference if determinable from context, date placeholder, procuring entity address, declaration of intent to bid, reference to enclosed documents.

## 2. COMPANY INTRODUCTION & CREDENTIALS
Overview of the company, year of establishment, core business areas, registration details (TIN, BIN, Trade License), organizational structure, quality management approach.

## 3. UNDERSTANDING OF REQUIREMENTS
Demonstrate thorough understanding of the tender scope, specific deliverables, technical specifications, and Bangladesh procurement standards that apply (PPA 2006 / PPR 2008).

## 4. TECHNICAL APPROACH & METHODOLOGY
Detailed methodology for completing the work. Include phases, milestones, quality controls, Bangladesh-specific considerations (monsoon season, local regulations, CPTU requirements). Reference relevant standards.

## 5. IMPLEMENTATION PLAN & WORK SCHEDULE
Week-by-week or month-by-month breakdown. Key milestones, dependencies, critical path activities. Formatted as a text-based schedule table.

## 6. PROJECT TEAM STRUCTURE
Team hierarchy and CV summaries for each person. Include: Name, Role, Qualification, Years of Experience, Key Responsibilities on this project.

## 7. EQUIPMENT & RESOURCE PLAN
List of equipment to be deployed. Source (owned/rented). Mobilization plan.

## 8. PAST SIMILAR PROJECTS
Table format for each project: Project Name, Client, Contract Value, Duration, Completion Year, Similarity to Current Tender, Client Contact Reference.

## 9. FINANCIAL PROPOSAL SUMMARY
Summarize the bid price breakdown (lump sum or key line items if BOQ-based). Payment milestone schedule aligned to work completion. Bid security confirmation.

## 10. QUALITY ASSURANCE & COMPLIANCE
Quality management approach. Standards to be followed. Inspection and testing plan. Bangladesh regulatory compliance (relevant BBS standards, BNBC, etc. as applicable).

## 11. COMPLIANCE DECLARATION
Formal declaration of compliance with all eligibility criteria, financial requirements, and submission requirements as specified in the SBD/IFB.

## 12. CLOSING & DECLARATIONS
Standard closing statements, authorized signatory placeholder, date, company seal reference.

─────────────────────────────────────────────────────
## BID STRENGTH ASSESSMENT (after proposal)
─────────────────────────────────────────────────────
After the proposal sections, provide a separate assessment. This is an
EXPLAINABLE READINESS SCORE based on the concrete factors below — it is
NOT a prediction of win probability. Do not claim or imply a probability
of winning; actual outcomes also depend on competitor bids, the
evaluation committee's judgment, and final pricing decisions outside
this analysis. Score honestly from the tender requirements and company
KB above — never invent experience, certifications, or documents the KB
doesn't contain; if something needed isn't in the KB, say so as a gap
rather than assuming it exists.

TECHNICAL SCORE: [0-100] — [brief reason]
COMMERCIAL SCORE: [0-100] — [brief reason]
EXPERIENCE SCORE: [0-100] — [brief reason]
COMPLIANCE SCORE: [0-100] — [brief reason]
OVERALL BID READINESS: [0-100 — a composite of the four scores above, weighted by what matters most for this specific tender]

BID STRATEGY: [SUBMIT / CONDITIONAL / WITHDRAW]

STRENGTHS:
- [strength 1]
- [strength 2]

CRITICAL GAPS:
- [gap 1]
- [gap 2]

RECOMMENDED ACTIONS BEFORE SUBMISSION:
- [action 1]
- [action 2]

PRICE COMPETITIVENESS: [above/within/below expected range] — [explanation]
"""


def _build_bid_strategy_prompt(tender_analysis: dict, company_kb: dict, language: str = "english") -> str:
    lang_instr = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["english"])

    projects_text = ""
    for i, p in enumerate(company_kb.get("past_projects", []), 1):
        projects_text += (
            f"\n  {i}. {p.get('name','—')} | Client: {p.get('client','—')} "
            f"| Value: {p.get('value','—')} | Year: {p.get('year','—')} | Category: {p.get('category','—')}"
        )

    team_text = ""
    for m in company_kb.get("technical_team", []):
        team_text += f"\n  - {m.get('name','—')} ({m.get('role','—')}) — {m.get('experience','—')} exp."

    turnover_text = ""
    for t in company_kb.get("annual_turnover", []):
        if t.get("amount"):
            turnover_text += f"\n  - {t.get('year','?')}: {t.get('amount','?')}"

    certs = ", ".join(c.get("name", "") for c in company_kb.get("certifications", []) if c.get("name"))
    equipment = ", ".join(
        f"{e.get('name','')}×{e.get('quantity',1)}" for e in company_kb.get("equipment", []) if e.get("name")
    )

    return f"""You are TenderOS — an expert AI Bid Strategy Advisor and Price Intelligence engine for Bangladesh procurement.

{_BD_CONTEXT}

LANGUAGE: {lang_instr}

CRITICAL RULES:
- Output MUST follow the EXACT format below — labels are parsed programmatically.
- Estimate prices from tender scope even if not explicitly stated, using Bangladesh market rates.
- Base match score on actual alignment between company KB and tender requirements.
- Do NOT skip any output label.

═══ TENDER ANALYSIS ═══
Summary: {(tender_analysis.get('summary') or '')[:1000]}

Eligibility Requirements:
{(tender_analysis.get('eligibility') or '')[:700]}

Financial Requirements:
{(tender_analysis.get('financial_requirements') or '')[:600]}

Compliance Matrix:
{(tender_analysis.get('compliance_matrix') or '')[:800]}

Risk Analysis:
{(tender_analysis.get('risk_analysis') or '')[:600]}

Bid Recommendation:
{(tender_analysis.get('bid_recommendation') or '')[:400]}

═══ COMPANY PROFILE ═══
Company: {company_kb.get('company_name', '[Unknown]')}
TIN: {company_kb.get('tin', 'Not provided')} | BIN: {company_kb.get('bin', 'Not provided')}
Trade License: {company_kb.get('trade_license', 'Not provided')} (Expires: {company_kb.get('trade_license_expiry', '?')})
Certifications: {certs or 'None listed'}
Annual Turnover:{turnover_text or ' Not specified'}
Past Projects:{projects_text or ' None added to KB'}
Technical Team:{team_text or ' Not specified'}
Equipment: {equipment or 'Not specified'}

═══ REQUIRED OUTPUT (machine-parsed — use exact labels) ═══

MATCH SCORE: [integer 0-100]
BID STRATEGY: [SUBMIT / CONDITIONAL / WITHDRAW]
RECOMMENDED PRICE: [e.g., ৳4.20 - ৳4.85 Crore, or "Insufficient data to estimate"]
ESTIMATED MARKET PRICE: [e.g., ৳4.60 Crore, or "Unknown"]
SUGGESTED MARGIN: [e.g., 18%, or "N/A"]
BID CONFIDENCE: [integer 0-100]
COMPETITION LEVEL: [HIGH / MEDIUM / LOW]
PRICE RISK: [HIGH / MEDIUM / LOW]

MATCH REASONS:
- [specific reason — what in the company profile matches this tender]
- [reason 2]
- [reason 3]
- [reason 4 if applicable]

CRITICAL GAPS:
- [specific gap — missing document, experience, certificate, or capacity]
- [gap 2 if any, else write "None identified"]

PRICE BREAKDOWN:
[Detailed cost breakdown by category: Labour, Materials, Equipment, Overhead, Profit, Contingency. Use realistic Bangladesh market rates for the sector. Show line items with estimated amounts in BDT Crore.]

PRICE STRATEGY:
[2-3 sentences advising how to price: competitive positioning, risk of abnormally low bid under PPR 2008, recommended approach.]

COMPLIANCE ASSESSMENT:
Total Requirements: [integer]
Fully Met: [integer]
Partially Met: [integer]
Missing: [integer]
COMPLIANCE SCORE: [integer 0-100]

Missing Requirements:
- [specific item not in KB or known to be missing]
- [item 2 if any, else "None identified"]

RISK ASSESSMENT:
Technical Risk: [HIGH/MEDIUM/LOW] — [one-line reason]
Financial Risk: [HIGH/MEDIUM/LOW] — [one-line reason]
Legal Risk: [HIGH/MEDIUM/LOW] — [one-line reason]
Operational Risk: [HIGH/MEDIUM/LOW] — [one-line reason]
Market Risk: [HIGH/MEDIUM/LOW] — [one-line reason]

RECOMMENDED ACTIONS:
- [Specific action 1 — what to do before bidding]
- [Action 2]
- [Action 3]
- [Action 4]
- [Action 5]

EXECUTIVE BRIEF:
[2-3 paragraphs for the company director. Should we pursue this tender? What is the strategic importance? What must be done in the next 7 days? What is the expected outcome if submitted?]
"""


def stream_bid_strategy(tender_analysis: dict, company_kb: dict, language: str = "english"):
    """Stream AI bid strategy analysis from Gemini."""
    prompt = _build_bid_strategy_prompt(tender_analysis, company_kb, language)
    client = _client()
    for chunk in client.models.generate_content_stream(model=_MODEL, contents=prompt):
        if getattr(chunk, "text", None):
            yield chunk.text


def _build_assistant_prompt(
    tender_analysis: dict,
    company_kb: dict,
    history: list[dict],
    question: str,
    language: str = "english",
) -> str:
    lang_instr = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["english"])

    projects_text = ""
    for i, p in enumerate(company_kb.get("past_projects", []), 1):
        projects_text += (
            f"\n  {i}. {p.get('name','—')} | Client: {p.get('client','—')} "
            f"| Value: {p.get('value','—')} | Year: {p.get('year','—')} | Category: {p.get('category','—')}"
        )

    team_text = ""
    for m in company_kb.get("technical_team", []):
        team_text += f"\n  - {m.get('name','—')} ({m.get('role','—')}) — {m.get('experience','—')} exp."

    certs_text = ""
    for c in company_kb.get("certifications", []):
        certs_text += f"\n  - {c.get('name','—')} | Expires: {c.get('expiry','—')}"

    equipment_text = ""
    for e in company_kb.get("equipment", []):
        equipment_text += f"\n  - {e.get('name','—')} × {e.get('quantity',1)}"

    history_text = ""
    for turn in history[-10:]:
        role = "User" if turn.get("role") == "user" else "Assistant"
        history_text += f"\n{role}: {(turn.get('content') or '')[:1500]}"

    return f"""You are the TenderOS AI Procurement Assistant — a Bangladesh tender expert embedded in this
specific tender's workspace. You help the user understand this one tender and whether/how their company
should bid on it.

{_BD_CONTEXT}

LANGUAGE: {lang_instr}

GROUNDING RULES (critical):
- Answer ONLY using the TENDER ANALYSIS, the Original Tender Document text, and the COMPANY PROFILE
  given below, plus general Bangladesh procurement knowledge (PPA 2006/PPR 2008, standard practice).
- If a specific clause, figure, or requirement isn't in the structured analysis, check the Original
  Tender Document text before concluding it's missing — the structured analysis is a summary and can
  omit details (e.g. penalty clauses, exact sub-dates) that are still present in the raw document.
- Never invent company experience, certifications, personnel, financial figures, or tender terms that
  are not present below.
- If the answer depends on information that isn't in the tender analysis, original document, or
  company profile, say so explicitly and name what's missing — do not guess or fill the gap with a
  plausible-sounding invention.
- Keep answers focused and actionable (a paragraph or a short list), not a full re-analysis, unless asked
  for one.
- You may reference the conversation so far for context, but always ground factual claims in the data below.

═══ TENDER ANALYSIS ═══
Title/Summary: {(tender_analysis.get('summary') or 'Not yet analyzed')[:1200]}

Eligibility Requirements:
{(tender_analysis.get('eligibility') or 'Not available')[:800]}

Financial Requirements:
{(tender_analysis.get('financial_requirements') or 'Not available')[:600]}

Required Documents:
{(tender_analysis.get('required_documents') or 'Not available')[:600]}

Compliance Matrix:
{(tender_analysis.get('compliance_matrix') or 'Not available')[:800]}

Risk Analysis:
{(tender_analysis.get('risk_analysis') or 'Not available')[:600]}

Bid Recommendation (from initial analysis):
{(tender_analysis.get('bid_recommendation') or 'Not available')[:500]}

Bid Strategy / Bid Intelligence (if generated):
{(tender_analysis.get('bid_strategy') or 'Not yet generated — user has not run the Bid Strategy Advisor.')[:1500]}

Draft Proposal (if generated):
{(tender_analysis.get('personalized_proposal') or 'Not yet generated — user has not run the AI Proposal Wizard.')[:2000]}

Original Tender Document (raw extracted text — use this for any specific clause, figure, or detail
not captured in the structured analysis above, e.g. penalties, exact dates, annexure requirements):
{(tender_analysis.get('original_text') or 'Not available')[:10000]}

═══ COMPANY PROFILE (from Knowledge Base) ═══
Company: {company_kb.get('company_name', 'Not provided')}
TIN: {company_kb.get('tin', 'Not provided')} | BIN: {company_kb.get('bin', 'Not provided')}
Trade License: {company_kb.get('trade_license', 'Not provided')} (Expires: {company_kb.get('trade_license_expiry', 'Not provided')})
Annual Turnover: {', '.join(f"{t.get('year','?')}: {t.get('amount','?')}" for t in company_kb.get('annual_turnover', []) if t.get('amount')) or 'Not specified'}
Certifications:{certs_text or ' None listed'}
Past Projects:{projects_text or ' None added to Knowledge Base'}
Technical Team:{team_text or ' Not specified'}
Equipment:{equipment_text or ' Not specified'}

═══ CONVERSATION SO FAR ═══{history_text or ' (this is the first question)'}

═══ CURRENT QUESTION ═══
{question}

Answer the current question now, grounded strictly in the information above."""


def stream_assistant_reply(
    tender_analysis: dict,
    company_kb: dict,
    history: list[dict],
    question: str,
    language: str = "english",
):
    """Stream a grounded answer from the AI Procurement Assistant for one tender."""
    prompt = _build_assistant_prompt(tender_analysis, company_kb, history, question, language)
    client = _client()
    for chunk in client.models.generate_content_stream(model=_MODEL, contents=prompt):
        if getattr(chunk, "text", None):
            yield chunk.text


def stream_personalized_proposal(
    tender_analysis: dict,
    company_kb: dict,
    wizard_data: dict,
    language: str = "english",
):
    """Stream a complete personalized proposal from Gemini."""
    prompt = _build_proposal_prompt(tender_analysis, company_kb, wizard_data, language)
    client = _client()
    for chunk in client.models.generate_content_stream(model=_MODEL, contents=prompt):
        if getattr(chunk, "text", None):
            yield chunk.text


# ---------------------------------------------------------------------------
# AI Document Validator
# ---------------------------------------------------------------------------

_DOC_VALIDATOR_PROMPT = """You are an AI Document Validator for Bangladesh procurement and business compliance.

Analyze the provided document (image or text) and extract the following information.

OUTPUT FORMAT (machine-parsed — use exact labels, one per line):
DOCUMENT_TYPE: [Trade License / TIN Certificate / BIN/VAT Certificate / ISO Certificate / Bank Solvency / Work Experience Certificate / Performance Security / Bank Guarantee / NID / Passport / Other]
DOCUMENT_NUMBER: [extracted number, or "Not found"]
ISSUING_AUTHORITY: [e.g., Dhaka North City Corporation, NBR Bangladesh, ISO body name, or "Not found"]
HOLDER_NAME: [name of company or person on document, or "Not found"]
ISSUE_DATE: [YYYY-MM-DD, or "Not found"]
EXPIRY_DATE: [YYYY-MM-DD, or "No expiry" if it does not expire, or "Not found"]
STATUS: [VALID / EXPIRING_SOON / EXPIRED / CANNOT_DETERMINE]
VALIDITY_NOTES: [brief note on validity — e.g., "Expires in 45 days", "Already expired", "Valid with no expiry"]
WARNINGS:
- [any concern — e.g., wrong company name, missing stamp, signature absent, etc.]
- [or "None" if no warnings]
"""


def ocr_pdf_with_gemini(content: bytes, max_pages: int = 15) -> str:
    """OCR a scanned PDF (no embedded text layer) via Gemini vision.

    Fallback for `deps.extract_text_from_file` when PyMuPDF's text-layer extraction
    comes back empty/near-empty. Renders pages to images with PyMuPDF (no external
    OCR engine/system dependency needed) and has Gemini transcribe them directly —
    also handles Bangla script, which a plain tesseract setup would need extra
    language packs for.
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")
    pages = list(doc)[:max_pages]

    parts: list = [
        "Transcribe ALL visible text from these scanned document pages, in reading "
        "order, exactly as written (English or Bangla). Do not summarize, translate, "
        "or omit anything. Output plain text only, with '--- Page N ---' separators "
        "between pages."
    ]
    for i, page in enumerate(pages, start=1):
        pix = page.get_pixmap(dpi=200)
        parts.append(f"--- Page {i} ---")
        parts.append(types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png"))

    client = _client()
    response = client.models.generate_content(model=_MODEL, contents=parts)
    return response.text if hasattr(response, "text") else ""


def validate_document(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    """Use Gemini to extract and validate a business document."""
    # For images: pass directly. For PDFs: extract text first.
    if mime_type in ("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"):
        content = [
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            _DOC_VALIDATOR_PROMPT,
        ]
    else:
        # For PDF/text files, extract text using PyMuPDF
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)[:6000]
        except Exception:
            text = file_bytes.decode("utf-8", errors="ignore")[:6000]
        content = [f"{_DOC_VALIDATOR_PROMPT}\n\nDOCUMENT TEXT:\n{text}"]

    client = _client()  # bind first — see the "Critical: client lifetime" note near _client()
    response = client.models.generate_content(model=_MODEL, contents=content)
    raw = response.text if hasattr(response, "text") else ""

    def get(pattern: str) -> str:
        m = re.search(pattern, raw, re.IGNORECASE)
        return m.group(1).strip() if m else "Not found"

    warnings = []
    in_warnings = False
    for line in raw.split("\n"):
        if line.strip().startswith("WARNINGS:"):
            in_warnings = True
            continue
        if in_warnings:
            clean = line.strip().lstrip("-•* ").strip()
            if clean and clean.lower() != "none" and not re.match(r"^[A-Z_]+:", clean):
                warnings.append(clean)

    return {
        "document_type":    get(r"DOCUMENT_TYPE:\s*(.+)"),
        "document_number":  get(r"DOCUMENT_NUMBER:\s*(.+)"),
        "issuing_authority": get(r"ISSUING_AUTHORITY:\s*(.+)"),
        "holder_name":      get(r"HOLDER_NAME:\s*(.+)"),
        "issue_date":       get(r"ISSUE_DATE:\s*(.+)"),
        "expiry_date":      get(r"EXPIRY_DATE:\s*(.+)"),
        "status":           get(r"STATUS:\s*(VALID|EXPIRING_SOON|EXPIRED|CANNOT_DETERMINE)"),
        "validity_notes":   get(r"VALIDITY_NOTES:\s*(.+)"),
        "warnings":         warnings,
        "filename":         filename,
    }
