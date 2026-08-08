# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TenderOS AI is a Bangladesh-focused SaaS for analyzing government, NGO, and private-sector tender documents. A FastAPI backend extracts text from PDF/TXT/DOCX, calls Google Gemini 2.5 Flash for a 9-section Bangladesh-specific analysis, and persists results in SQLite (dev) or PostgreSQL (Docker). A Next.js 16 App Router frontend handles auth, upload, tender library, bid tracking, and PDF/DOCX export.

## Commands

### Docker (full stack)
```bash
docker compose up --build      # postgres:5435, backend:8008, frontend:3008
```
Requires `GEMINI_API_KEY` in the environment (or root `.env`).

### Backend (local)
```bash
source .venv/bin/activate
export DATABASE_URL="sqlite:///./tenderos_dev.db"
export GEMINI_API_KEY=...
uvicorn main:app --reload --port 8008   # run from backend/
```

### Frontend (local)
```bash
cd frontend && npm install
NEXT_PUBLIC_API_URL=http://localhost:8008 npm run dev    # :3008 (npm run dev binds -p 3008)
```

### Backend tests
```bash
source .venv/bin/activate   # from backend/
python -m pytest tests/ -v
```

### Alembic migrations
```bash
source .venv/bin/activate   # from backend/
export DATABASE_URL="sqlite:///./tenderos_dev.db"
alembic upgrade head        # apply all pending migrations
alembic revision --autogenerate -m "description"   # generate new migration
```

## Architecture

### Backend (`backend/`)
- **main.py** — all FastAPI routes, auth, rate limiting, PDF/DOCX export, usage limiting
- **hermes_client.py** — Gemini integration. `analyze_with_gemini()` and `stream_with_gemini()`
- **models.py** — SQLAlchemy ORM: `User` and `Tender`
- **database.py** — engine/session; reads `DATABASE_URL` from env (no fallback)
- **migrations/** — Alembic migrations. Run `alembic upgrade head` on new installs

### Frontend (`frontend/app/`)
- **page.tsx** — root shell (token/user/subscription/tenders/selectedTender state)
- **components/** — AuthPage, Dashboard, Sidebar, MetricsGrid, UploadPanel, TenderLibrary, TenderDetail, ProfilePanel, Section

### API endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/signup | Register (5/min rate limit) |
| POST | /auth/login | Login, rotates token (10/min) |
| GET | /me | Current user |
| PUT | /me/profile | Update company profile |
| GET | /subscription | Plan info + monthly usage |
| GET | /tenders | List (search + pagination) |
| POST | /tenders/analyze | Upload + analyze (non-streaming) |
| POST | /tenders/analyze-stream | Upload + analyze (SSE streaming) |
| GET | /tenders/{id} | Tender detail |
| PATCH | /tenders/{id} | Update bid_status / notes / deadline |
| POST | /tenders/{id}/reanalyze | Re-run AI with different language |
| DELETE | /tenders/{id} | Delete |
| GET | /tenders/{id}/export-docx | Download DOCX |
| GET | /tenders/{id}/export-pdf | Download PDF |

### Critical: prompt/parser coupling
`hermes_client._SECTIONS` defines **9 sections** in order. The prompt (`_build_prompt`) emits exactly these `### ` headings; `parse_gemini_response` splits the response by matching consecutive headings. **Any rename/reorder breaks parsing silently.**

Current sections in order:
1. Executive Summary → `summary`
2. Eligibility Criteria → `eligibility`
3. Financial Requirements → `financial_requirements`
4. Required Documents → `required_documents`
5. Compliance Matrix → `compliance_matrix`
6. Risk Analysis → `risk_analysis`
7. Bid Recommendation → `bid_recommendation`
8. Tender Submission Draft → `proposal_draft`
9. Final Submission Checklist → `final_checklist`

- Headings are always English even for Bangla output (parser stability)
- Bid score is extracted from `bid_recommendation` via `BID SCORE: NN` regex in `_extract_bid_score()`
- Gemini failure → `summary` starts with `"Gemini API Error:"` → tender `status = "failed"`

### Auth & sessions
- Custom token auth via `Authorization: Bearer <token>` header
- PBKDF2-HMAC-SHA256 password hashing with per-user salt
- 30-day sliding session expiry; token rotated on login
- `get_current_user` FastAPI dependency resolves token → scoped user

### Subscription / usage limits
- `User.plan`: `free` | `pro` | `business` (stored in DB)
- Free plan: 5 analyses/month (resets monthly). `check_usage_limit()` enforces this
- Pro/Business: unlimited (`PLAN_LIMITS = {"pro": -1, "business": -1}`)
- `increment_usage()` called after each successful analysis (including reanalyze)
- Upgrade path: mailto link to support (no payment integration yet)

### Schema evolution
`ensure_schema()` in `main.py` runs `ALTER TABLE ... ADD COLUMN` for any column missing at startup. When adding a column:
1. Add to `models.py`
2. Add to `ensure_schema()` column map
3. Create Alembic migration in `migrations/versions/`
4. Update `get_tender_response()` to include the new field
5. Update frontend types and components

### Rate limiting
`slowapi` with `TESTING=1` env var → UUID per request (limits never accumulate in tests).

## Bangladesh procurement context
The AI prompt includes deep context on: PPA 2006, PPR 2008, CPTU, e-GP system, key procuring entities (LGED, RHD, BWDB, RAJUK, PWD), NGO/donor guidelines (World Bank, ADB, UNDP), bid security/performance security norms, and BDT currency.

## Environment & ports

This host runs other unrelated apps on the common defaults (3000, 8000, etc.) —
TenderOS uses these fixed, non-default ports everywhere (Docker *and* local
dev use the same numbers, so there's no separate "local default" to
misremember or collide with something else):

| Service  | Port | Notes |
|----------|------|-------|
| frontend | 3008 | `npm run dev` binds `-p 3008` directly (see `frontend/package.json`) |
| backend  | 8008 | pass `--port 8008` explicitly to `uvicorn` for local runs |
| postgres | 5435 | Docker only — local dev uses SQLite, no port needed |

Never start an ad-hoc dev server on 3000/8000 "just for a quick test" on this
host — it will collide with other running apps. Always use 3008/8008.

Upload cap: 15 MB. Accepted: `.pdf`, `.txt`, `.docx`. First 18,000 chars sent to Gemini.
