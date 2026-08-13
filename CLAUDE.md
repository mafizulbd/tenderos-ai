# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TenderOS AI is a Bangladesh-focused, multi-tenant SaaS for the full tender-response workflow: discovery, AI analysis, company-knowledge-grounded proposal drafting, bid strategy, compliance/document validation, and submission tracking. A FastAPI backend extracts text from PDF/TXT/DOCX (with an OCR fallback for scanned PDFs via Gemini vision), calls Google Gemini 2.5 Flash for a 9-section Bangladesh-specific analysis plus several other AI-generation flows, and persists results in SQLite (dev) or PostgreSQL (Docker). A Next.js 16 App Router frontend handles auth, upload, tender library, bid tracking, a company Knowledge Base, a Proposal Wizard, a Bid Strategy panel, a grounded AI Assistant chat, tender discovery, calendar/notifications, and PDF/DOCX export — in English or Bangla.

**Before trusting any architecture description below, verify against the code** — this file has drifted from reality before (see `PROJECT_AUDIT.md` §0 for the incident). When in doubt, `grep`/`ls` rather than assume.

See `PROJECT_AUDIT.md`, `PRODUCT_STRATEGY.md`, and `COMPETITOR_GAP_ANALYSIS.md` at the repo root for the current-state audit, product direction, and market research this project is working from.

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
- **main.py** (~250 lines) — app wiring, CORS, `ensure_schema()` additive migrations + one-time data backfills, router registration, APScheduler lifecycle. No route logic lives here.
- **routers/** — one file per domain, all included from `main.py`:
  - `auth.py` — signup/login/logout, email verification, password reset, `/me`, `/me/knowledge-base`
  - `orgs.py` — Organizations, memberships, invites (multi-user Teams)
  - `company.py` — structured company Knowledge Base: Personnel, Certifications, Project Experience (org-scoped CRUD tables; see "Company Knowledge Base" below)
  - `tenders.py` (largest router) — list/detail/update/delete, analyze (sync + SSE streaming), reanalyze, DOCX/PDF export, AI Proposal Wizard, AI Bid Strategy, AI Assistant chat
  - `approvals.py`, `comments_tasks.py`, `vendors.py`, `contracts.py` — secondary collaboration/CRM modules; backend fully live but **hidden from the frontend nav** via `frontend/app/features.ts`'s `SECONDARY_MODULES_ENABLED = false` (see that file's comment for why — short version: these solve team-governance problems a solo bidder doesn't have yet)
  - `documents.py` — Document Validator (OCR fallback for scanned PDFs via Gemini vision)
  - `notifications.py`, `calendar.py` — computed + persisted reminders (deadlines, cert/contract expiry), calendar feed
  - `discovery.py` — tender discovery scrapers (see below)
- **hermes_client.py** — all Gemini calls: 9-section tender analysis, personalized proposal generation (Proposal Wizard), bid strategy generation, grounded AI Assistant replies, OCR-via-vision, document validation. Uses the `google-genai` SDK (not the deprecated `google-generativeai`).
- **discovery.py** — scrapers: `scrape_eprocure_bd()` (Bangladesh e-GP, the primary local source), `scrape_world_bank()`, `scrape_undp()`. `scrape_ungm()` exists but currently returns 0 results (stale selector); ADB was dropped (bot-protected, returns 403).
- **email_client.py** / **sms_client.py** — Resend and Twilio integrations respectively; both best-effort no-op if their API keys are unset in the environment.
- **scheduler.py** — APScheduler background jobs (scheduled discovery refresh, deadline reminders); disabled under `TESTING=1`.
- **models.py** — SQLAlchemy ORM, org-scoped multi-tenancy throughout: `Organization`, `OrgMembership`, `OrgInvite`, `User`, `Tender`, `ApprovalRequest`, `Comment`, `Task`, `Vendor`, `TenderVendorLink`, `Contract`, `Notification`, `DiscoveredTender`, `Personnel`, `Certification`, `ProjectExperience`.
- **database.py** — engine/session; reads `DATABASE_URL` from env (no fallback)
- **migrations/** — Alembic migrations exist (`alembic upgrade head` on new installs) but are **not** the thing actually keeping this repo's dev/Docker databases current — `ensure_schema()` in `main.py` (imperative `ALTER TABLE`/`CREATE TABLE` + idempotent backfills, run on every app startup) is. Both exist; see `PROJECT_AUDIT.md` §5 for the tracked debt. When you add a table/column, update **both**.

### Frontend (`frontend/app/`)
- **page.tsx** — root shell (token/user/subscription/tenders/selectedTender state)
- **features.ts** — `SECONDARY_MODULES_ENABLED` flag; flip to `true` to re-expose Approvals/Comments/Tasks/Vendor CRM/Contracts in the nav
- **i18n/** — English/Bangla translation dictionaries + `LanguageContext`; hardcoded string-pair translations per component, not a formal i18n framework (tracked as debt in `PROJECT_AUDIT.md` §12)
- **components/** — 28 files, flat (no subfolders). Core loop: AuthPage, Dashboard, Sidebar, MetricsGrid, UploadPanel, TenderLibrary, TenderDetail, ProfilePanel. Also live: KnowledgeBasePanel, ProposalWizard, BidStrategyPanel, DocumentValidator, TenderDiscovery, UnifiedCalendar, NotificationsPanel, AssistantPanel, LanguageToggle, PlanWidget — plus the flagged-off secondary-module components (ApprovalPanel, CommentsPanel, TasksPanel, VendorLibrary/VendorDetail/LinkedVendorsPanel, ContractLibrary/ContractDetail, TeamPanel).

### API endpoints (representative, not exhaustive — see `routers/` for the full surface)
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/signup | Register (5/min rate limit) |
| POST | /auth/login | Login, rotates token (10/min) |
| GET | /me | Current user |
| GET/PUT | /me/knowledge-base | Legacy JSON-blob KB (basics/equipment/turnover only — see below) |
| GET | /subscription | Plan info + monthly usage |
| GET/POST/PATCH/DELETE | /company/personnel, /company/certifications, /company/projects | Structured company Knowledge Base (org-scoped tables) |
| GET | /tenders | List (search + pagination) |
| POST | /tenders/analyze, /tenders/analyze-stream | Upload + analyze (non-streaming / SSE) |
| GET/PATCH/DELETE | /tenders/{id} | Detail / update bid_status,notes,deadline / delete |
| POST | /tenders/{id}/reanalyze | Re-run AI with different language |
| POST | /tenders/{id}/generate-proposal | AI Proposal Wizard (personalized, KB-grounded) |
| POST | /tenders/{id}/bid-strategy | AI Bid Strategy (compliance + risk heatmap) |
| POST | /tenders/{id}/assistant | Grounded per-tender AI chat |
| GET | /tenders/{id}/export-docx, /export-pdf | Download |
| GET | /discovery/tenders | Discovered tenders (eprocure.gov.bd, World Bank, UNDP) |
| GET | /calendar, /notifications | Calendar feed, notifications (persisted + computed) |

### Company Knowledge Base
Two storage layers, deliberately split:
- **Structured tables** (`Personnel`, `Certification`, `ProjectExperience` in `models.py`, CRUD via `routers/company.py`) — org-scoped, queryable, and what AI prompts are grounded in. `deps._merge_structured_company_data()` overlays these onto a knowledge-base dict for every AI call site (Proposal Wizard, Bid Strategy, AI Assistant, cert-expiry notifications); it falls back to the JSON blob's copy of the same fields only if an org has zero structured rows yet (e.g. mid-backfill).
- **`User.knowledge_base` JSON blob** (`/me/knowledge-base`) — still the only home for equipment, annual turnover, and registration basics (TIN/BIN/trade license). Was also the only home for past projects/team/certifications before this got split out; a one-time idempotent startup backfill (`main._backfill_structured_company_data()`) migrates any pre-existing blob data into the structured tables per-org, guarded on "org already has structured rows" so it only ever runs once per org.

When adding a new grounded-AI feature that needs company data, call `_get_knowledge_base(user)` then `_merge_structured_company_data(kb, organization_id, db)` — don't read the blob's `technical_team`/`certifications`/`past_projects` directly, they may be stale.

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
`ensure_schema()` in `main.py` runs `ALTER TABLE ... ADD COLUMN` (existing tables) and `CREATE TABLE` (new tables) for anything missing at startup — this is what actually keeps dev SQLite and Docker Postgres current, not `alembic upgrade head` (see Architecture above). When adding a column to an existing table:
1. Add to `models.py`
2. Add to `ensure_schema()` column map
3. Create an Alembic migration in `migrations/versions/` anyway, chained to the current head (keeps the documented `alembic upgrade head` path correct for anyone who does use it on a fresh install)
4. Update `get_tender_response()` to include the new field
5. Update frontend types and components

When adding a new **table**, also: create it in `ensure_schema()` via `Base.metadata.tables["name"].create(bind=engine)`, register any router that exposes it in `main.py`, and add a corresponding `op.create_table(...)` to the Alembic migration.

### Rate limiting
`slowapi` with `TESTING=1` env var → UUID per request (limits never accumulate in tests).

### Timestamps
Use `timeutils.utcnow()`, never `datetime.utcnow()` (deprecated, and was generating 2000+ warnings per test run before this was cleaned up). It returns the same naive-UTC value `datetime.utcnow()` used to — safe to compare directly against existing `DateTime` columns and other `utcnow()` results — without the deprecation warning. Every ORM `default=` timestamp in `models.py` already uses it; do the same for any new one.

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
