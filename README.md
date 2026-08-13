# TenderOS AI

TenderOS AI is a Bangladesh-focused, multi-tenant SaaS for the tender-response workflow: discovery, AI analysis, company-knowledge-grounded proposal drafting, bid strategy, compliance/document validation, and submission tracking — in English or Bangla.

See `PROJECT_AUDIT.md` for a current-state technical audit, `PRODUCT_STRATEGY.md` for product direction, and `COMPETITOR_GAP_ANALYSIS.md` for market research. `CLAUDE.md` has the detailed architecture reference.

## Features

- Tender PDF/TXT/DOCX upload, with an OCR fallback (Gemini vision) for scanned PDFs
- 9-section AI tender analysis (executive summary, eligibility, financial requirements, required documents, compliance matrix, risk analysis, bid recommendation, submission draft, final checklist)
- Company Knowledge Base — structured Personnel/Certifications/Project Experience (org-shared), plus equipment/turnover/registration basics
- AI Proposal Wizard — full proposal generation grounded in the tender + your company's real Knowledge Base
- AI Bid Strategy — compliance and risk heatmap
- AI Assistant — grounded per-tender Q&A chat
- Tender Discovery — scrapers for eprocure.gov.bd (Bangladesh e-GP), World Bank, and UNDP
- Document Validator, calendar + deadline reminders (email, WhatsApp/SMS)
- Bid lifecycle tracking, DOCX/PDF export
- English/Bangla UI toggle
- Multi-tenant Organizations; Teams/Approvals/Comments/Vendor CRM/Contracts modules exist in the backend but are hidden from the nav by default (`frontend/app/features.ts`) — see `PROJECT_AUDIT.md` for why

## Tech Stack

- Frontend: Next.js 16 (App Router)
- Backend: FastAPI (routers/ package, not a monolith)
- Database: PostgreSQL (Docker) / SQLite (local dev)
- AI: Google Gemini 2.5 Flash (`google-genai` SDK)
- PDF Parser: PyMuPDF
- DOCX Export: python-docx
- Containerization: Docker Compose

## Project Structure

```text
tenderos-ai/
├── backend/
│   ├── Dockerfile
│   ├── main.py              # app wiring, schema migration, router registration
│   ├── database.py
│   ├── models.py
│   ├── deps.py               # shared FastAPI dependencies/helpers
│   ├── schemas.py            # Pydantic request models
│   ├── hermes_client.py      # all Gemini calls
│   ├── discovery.py          # tender discovery scrapers
│   ├── email_client.py
│   ├── sms_client.py
│   ├── scheduler.py
│   ├── routers/               # one file per domain (auth, tenders, company, orgs, ...)
│   ├── migrations/            # Alembic
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── app/
│       ├── page.tsx
│       ├── features.ts        # SECONDARY_MODULES_ENABLED flag
│       ├── i18n/               # English/Bangla translations
│       └── components/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── CLAUDE.md
├── PROJECT_AUDIT.md
├── PRODUCT_STRATEGY.md
├── COMPETITOR_GAP_ANALYSIS.md
└── README.md
```

## Getting Started

See `CLAUDE.md` → "Commands" for the local-dev and Docker commands (fixed ports: frontend 3008, backend 8008, Postgres 5435).
