import os
import re
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")


def extract_section(text: str, start: str, end: str | None = None) -> str:
    if end:
        pattern = rf"{start}(.*?){end}"
    else:
        pattern = rf"{start}(.*)"

    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else "Not found in the document."


def analyze_with_gemini(tender_text: str) -> dict:
    prompt = f"""
You are TenderOS AI, an expert tender preparation and proposal drafting assistant.

Rules:
- Use only information found in the tender document.
- Do not invent company history, certifications, project experience, team members, or pricing.
- If information is missing, write: Not found in the document.
- Keep analysis sections concise and practical.
- The Tender Submission Draft should be formal, professional, and ready for editing/submission.

Analyze the tender document and return the output EXACTLY using these section headings:

### Executive Summary
Summarize the tender purpose, procuring entity, key work/supply requirement, deadline, and main submission requirement.

### Eligibility Criteria
List eligibility conditions, qualification requirements, experience requirements, and bidder requirements found in the document.

### Required Documents
List all required documents, forms, certificates, declarations, financial documents, technical documents, and supporting papers.

### Compliance Matrix
Create a practical compliance matrix in text table format with columns:
Requirement | Tender Clause/Reference | Required Action | Status

### Risk Analysis
Identify risks such as missing documents, strict deadlines, unclear clauses, penalties, bid security issues, technical compliance issues, or disqualification risks.

### Tender Submission Draft
Prepare a formal submission-ready tender proposal draft as if the bidder is submitting the tender.

Include:
1. Cover Letter
2. Understanding of Requirement
3. Technical Response
4. Scope of Work / Supply
5. Compliance Statement
6. Delivery / Execution Commitment
7. Conclusion

Rules for this section:
- Write in formal tender submission language.
- Keep it directly relevant to the tender.
- Use only facts from the tender document.
- Do not add fake company experience.
- Do not add fake certificates.
- Do not add fake team members.
- If bidder/company details are missing, use placeholders like [Company Name], [Authorized Representative], [Date].
- The output should be ready for user editing and submission.

### Final Submission Checklist
Create a final checklist of actions before submission.

Tender Document:
{tender_text[:30000]}
"""

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()

        return {
            "summary": extract_section(raw, r"### Executive Summary", r"### Eligibility Criteria"),
            "eligibility": extract_section(raw, r"### Eligibility Criteria", r"### Required Documents"),
            "required_documents": extract_section(raw, r"### Required Documents", r"### Compliance Matrix"),
            "compliance_matrix": extract_section(raw, r"### Compliance Matrix", r"### Risk Analysis"),
            "risk_analysis": extract_section(raw, r"### Risk Analysis", r"### Tender Submission Draft"),
            "proposal_draft": extract_section(raw, r"### Tender Submission Draft", r"### Final Submission Checklist"),
            "final_checklist": extract_section(raw, r"### Final Submission Checklist"),
        }

    except Exception as e:
        return {
            "summary": f"Gemini API Error: {str(e)}",
            "eligibility": "Not generated",
            "required_documents": "Not generated",
            "compliance_matrix": "Not generated",
            "risk_analysis": "Not generated",
            "proposal_draft": "Not generated",
            "final_checklist": "Not generated"
        }
