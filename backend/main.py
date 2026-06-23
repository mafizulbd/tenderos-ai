import fitz
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from docx import Document

from database import Base, engine, SessionLocal
from models import Tender
from hermes_client import analyze_with_gemini

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TenderOS AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def extract_text_from_file(file_name: str, content: bytes) -> str:
    if file_name.lower().endswith(".pdf"):
        text = ""
        pdf = fitz.open(stream=content, filetype="pdf")
        for page in pdf:
            text += page.get_text()
        return text

    return content.decode("utf-8", errors="ignore")


@app.get("/")
def home():
    return {"status": "TenderOS backend running"}


@app.post("/tenders/analyze")
async def analyze_tender(
    title: str = Form(...),
    language: str = Form("english"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    tender_text = extract_text_from_file(file.filename, content)

    if len(tender_text.strip()) < 20:
        tender_text = "Unable to extract readable text from this file."

    result = analyze_with_gemini(tender_text, language)

    tender = Tender(
        title=title,
        language=language,
        original_text=tender_text,
        summary=result["summary"],
        eligibility=result["eligibility"],
        required_documents=result["required_documents"],
        compliance_matrix=result["compliance_matrix"],
        risk_analysis=result["risk_analysis"],
        proposal_draft=result["proposal_draft"],
        final_checklist=result["final_checklist"],
    )

    db.add(tender)
    db.commit()
    db.refresh(tender)

    return get_tender_response(tender)


def get_tender_response(tender):
    return {
        "id": tender.id,
        "title": tender.title,
        "language": tender.language,
        "summary": tender.summary,
        "eligibility": tender.eligibility,
        "required_documents": tender.required_documents,
        "compliance_matrix": tender.compliance_matrix,
        "risk_analysis": tender.risk_analysis,
        "proposal_draft": tender.proposal_draft,
        "final_checklist": tender.final_checklist,
        "created_at": tender.created_at,
    }


@app.get("/tenders")
def list_tenders(db: Session = Depends(get_db)):
    tenders = db.query(Tender).order_by(Tender.id.desc()).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "language": t.language,
            "created_at": t.created_at,
            "summary": t.summary[:180] if t.summary else ""
        }
        for t in tenders
    ]


@app.get("/tenders/{tender_id}")
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()

    if not tender:
        return {"error": "Tender not found"}

    return get_tender_response(tender)


@app.get("/tenders/{tender_id}/export-docx")
def export_docx(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()

    if not tender:
        return {"error": "Tender not found"}

    doc = Document()
    doc.add_heading("TenderOS AI - Tender Analysis Report", 0)
    doc.add_heading(tender.title, level=1)
    doc.add_paragraph(f"Output Language: {tender.language}")

    sections = [
        ("Executive Summary", tender.summary),
        ("Eligibility Criteria", tender.eligibility),
        ("Required Documents", tender.required_documents),
        ("Compliance Matrix", tender.compliance_matrix),
        ("Risk Analysis", tender.risk_analysis),
        ("Tender Submission Draft", tender.proposal_draft),
        ("Final Submission Checklist", tender.final_checklist),
    ]

    for title, content in sections:
        doc.add_heading(title, level=2)
        doc.add_paragraph(content or "Not available")

    file_stream = BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename=tender_{tender.id}_report.docx"
        }
    )
