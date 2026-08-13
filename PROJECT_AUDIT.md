# TenderOS AI — Project Audit

**Date:** 2026-08-12
**Branch audited:** `feature/procurement-os-mvp` (1 commit ahead of `main` in spirit — see note below)
**Method:** direct repo inspection (`git log`, file tree, `models.py`, `main.py`, `hermes_client.py`, `discovery.py`, `docker-compose.yml`, `requirements.txt`, `package.json`), full backend test run (124/124 passing).

---

## 0. Important finding before anything else: the docs lie about the app

`CLAUDE.md` and `README.md` both describe a single-tenant MVP: one `main.py` monolith, one `Tender` model, 9 AI sections, no auth beyond what's listed, PostgreSQL-only. That description matches the state of the repo as of roughly **mid-July**. The actual repo today is much further along. Commit history (`git log --oneline`, oldest→newest) shows two full unlabeled build cycles that neither doc reflects:

- **Phase 1 MVP** (`52517ed`) → **Phase 2** (`2d207ab`…`5fb262c`): multi-user Teams/Orgs/roles/invites, approval workflow, comments & tasks, vendor CRM, contracts, calendar & notifications.
- **Phase 0 hardening** (`b569721`): backend split from one `main.py` into a `routers/` package, Gemini SDK migrated (`google-generativeai` → `google-genai`), CORS fixed, email verification/password reset added.
- **A second "Phase 1"** (BD-specific wedge): `eprocure.gov.bd` scraper, World Bank/UNDP scraper repairs, OCR fallback for scanned PDFs (Gemini vision), WhatsApp/SMS deadline reminders (Twilio), APScheduler for scheduled discovery.
- **A second "Phase 2"**: English/Bangla UI toggle rolled out across every panel (5 translation-tier commits).
- **Most recent**: an AI Procurement Assistant — grounded per-tender Q&A chat, backend (`d7b8460`) + frontend (`5201c2c`) + a grounding fix (`5f6a31f`, HEAD).

**Practical implication:** `CLAUDE.md` is the file Claude Code reads first on every session, and it is actively misleading about what exists. Section 5 of this audit (Technical Debt) flags this as the top-priority fix — not because it blocks a feature, but because every future session (including this one) starts by reasoning from a wrong model of the codebase.

---

## 1. Current Architecture

**Backend** (`backend/`, FastAPI):
- `main.py` (175 lines) — app wiring, CORS, `ensure_schema()` additive migrations, org backfill for pre-org users, router registration, APScheduler lifecycle. No route logic lives here anymore.
- `routers/` — 11 domain routers: `auth`, `orgs`, `tenders` (by far the largest, 30KB — analysis, reanalyze, bid strategy, proposal wizard, AI assistant, export all live here), `approvals`, `comments_tasks`, `vendors`, `contracts`, `documents`, `notifications`, `calendar`, `discovery`.
- `hermes_client.py` (32KB) — all Gemini calls: 9-section tender analysis, personalized proposal generation, bid strategy generation, grounded assistant replies, OCR-via-vision for scanned PDFs, document validation. Uses `google-genai` (current SDK).
- `models.py` — 13 tables: `Organization`, `OrgMembership`, `OrgInvite`, `User`, `Tender`, `ApprovalRequest`, `Comment`, `Task`, `Vendor`, `TenderVendorLink`, `Contract`, `Notification`, `DiscoveredTender`.
- `discovery.py` — scrapers for `eprocure.gov.bd`, World Bank, UNDP, UNGM (UNGM currently broken/returns 0, ADB dropped — bot-protected).
- `email_client.py` / `sms_client.py` — Resend and Twilio integrations, both best-effort no-op if API keys are unset (neither is configured in this environment yet).
- `scheduler.py` — APScheduler background jobs (discovery refresh, deadline reminders).
- Migrations: both Alembic (`migrations/`) **and** an imperative `ensure_schema()` `ALTER TABLE` step in `main.py` that runs on every startup. Two migration systems doing overlapping work — see Technical Debt.

**Frontend** (`frontend/app/`, Next.js 16 App Router, no UI framework — hand-rolled components + `lucide-react` icons):
- 28 components under `components/`. Beyond the "core loop" (Auth, Upload, TenderLibrary, TenderDetail, Sidebar, MetricsGrid, ProfilePanel) there's a full second layer: `ProposalWizard`, `BidStrategyPanel`, `KnowledgeBasePanel`, `DocumentValidator`, `TenderDiscovery`, `UnifiedCalendar`, `NotificationsPanel`, `AssistantPanel`, `TeamPanel`, `ApprovalPanel`, `CommentsPanel`, `TasksPanel`, `VendorLibrary`/`VendorDetail`/`LinkedVendorsPanel`, `ContractLibrary`/`ContractDetail`, `LanguageToggle`, `PlanWidget`.
- `frontend/app/features.ts` → `SECONDARY_MODULES_ENABLED = false` — a single flag hides Approvals/Comments/Tasks/Vendor CRM/Contracts from the nav. **Backend routes and DB tables for all of these are fully live**, just not linked from the UI. This is a real, working kill-switch, not dead code.

**Infra:** Docker Compose (`postgres:5435`, `backend:8008`, `frontend:3008`), matches `CLAUDE.md`'s port table correctly (that part of the docs is accurate). `NEXT_PUBLIC_API_URL` is correctly threaded as a Docker **build** arg (a real bug from a past session — Next.js inlines `NEXT_PUBLIC_*` at build time, not runtime — was found and fixed).

---

## 2. Current Features (all present in code, whether or not exposed in nav)

**Exposed in default nav** (`SECONDARY_MODULES_ENABLED = false`):
- Auth: signup/login/token rotation/email verification/password reset (Resend, currently no-op — no API key configured)
- Upload → 9-section AI analysis (streaming SSE), English or Bangla output
- Re-analyze with different language
- Tender library (search, pagination), bid lifecycle status, deadline, notes
- Bid score extraction (regex off `bid_recommendation`)
- DOCX + PDF export
- Company Knowledge Base (JSON blob on `User.knowledge_base`: past projects, team, equipment, certs)
- Proposal Wizard — generates a full proposal grounded in the KB (`personalized_proposal`)
- Bid Strategy engine — compliance + risk heatmap grounded in KB + tender analysis (`bid_strategy`)
- Document Validator — OCR fallback via Gemini vision for scanned PDFs, general document validation
- Tender Discovery — pulls from `eprocure.gov.bd` (BD govt e-GP), World Bank, UNDP (UNGM broken)
- Calendar + deadline reminders (WhatsApp/SMS via Twilio — no-op, unconfigured)
- Notifications panel
- AI Procurement Assistant — per-tender grounded chat, answers from the raw extracted document text + analysis, not just the summary (most recent commit)
- English/Bangla UI toggle across the whole app shell
- Usage limiting: free plan 5 analyses/month, pro/business unlimited

**Built but hidden behind the feature flag** (real backend + DB + frontend components, zero nav entry point):
- Multi-user Teams: Organizations, roles (owner/admin/member), invites
- Approval workflow for tenders
- Comments & Tasks (generic, attachable to tender/vendor/contract)
- Vendor/supplier CRM (`Vendor`, `TenderVendorLink`)
- Contracts module (`Contract`, linked to tender + vendor)

## 3. Working Features (verified this session)

- Full backend test suite: **124/124 passing** (`pytest tests/ -q`), ~77s.
- No secrets committed: `.env` is gitignored and not in history; `.env.example` contains only placeholders; `*.db` files are gitignored (though two dev `.db` files exist locally, correctly untracked).
- CORS is environment-driven, not `allow_origins=["*"]` (was a real bug, since fixed).
- Discovery scrapers for eprocure.gov.bd/World Bank/UNDP verified working per prior session's live test (80 tenders pulled with zero errors). Not re-verified live in this session.

## 4. Broken / Incomplete Features

- **UNGM scraper**: silently returns 0 results — selector is stale against the current UNGM page markup. Not failing loudly, just useless.
- **ADB scraper**: removed. `adb.org` 403s every tender/project path (bot-protected). No workaround attempted (correctly — evasion wasn't pursued).
- **Email verification / password reset**: code path is complete but `RESEND_API_KEY` is unset in this environment, so it's a silent no-op. A user can sign up but never receives a verification email.
- **WhatsApp/SMS deadline reminders**: same story — Twilio env vars are placeholders, so reminders silently don't send.
- **`Base.metadata.create_all()` + `ensure_schema()` ALTER-TABLE dance vs. Alembic**: both exist. `ensure_schema()` in `main.py` is the thing that actually runs on every app startup and keeps SQLite/Postgres schemas current; Alembic migrations exist in `migrations/versions/` but it's unclear if they're actually run in the Docker path or just available for manual `alembic upgrade head`. This is fragile — two sources of truth for schema state.

## 5. Technical Debt

1. **Stale `CLAUDE.md` / `README.md`** (highest priority to fix — cheap, and it's actively steering future sessions wrong). Neither file mentions: `routers/` split, Organizations/multi-tenancy, any of the 4 secondary modules, Proposal Wizard, Bid Strategy engine, Knowledge Base, Discovery, Document Validator/OCR, Calendar/Notifications, Bangla toggle, or the AI Assistant. `CLAUDE.md`'s "Critical: prompt/parser coupling" section (9-section `_SECTIONS` array) is still accurate and worth keeping — it's just surrounded by an outdated picture of everything else.
2. **Dual schema-migration systems** (Alembic + imperative `ensure_schema()`). Works today because `ensure_schema()` is additive-only and idempotent, but it means every schema change has to be hand-written twice (once as an `ALTER TABLE` string, once as an Alembic revision), and there's no guarantee they stay in sync.
3. **`tenders.py` router is 30KB** — analysis, reanalyze, proposal wizard, bid strategy, AI assistant, and export all live in one file. Not urgent (it works, tests pass), but it's the one router that will keep growing since it's the product's core loop.
4. **`datetime.utcnow()` deprecation warnings** — 1960 warnings in the test run, all `DeprecationWarning: datetime.datetime.utcnow() is deprecated`. Harmless today, will break on a future Python version.
5. **No CI/CD** — noted in prior session's memory, still true. Tests exist and pass but nothing runs them automatically on push/PR.
6. **No error tracking** (Sentry or equivalent) — failures in production (once there is a production) would be invisible beyond what's logged locally.
7. **Weak default Postgres credentials** in `docker-compose.yml`/`.env.example` (`tenderos`/`tenderos123`) — fine for local/staging, must not ship to a real production target as-is.
8. **`frontend/app/components/` is flat** — 28 files, no subfolders by domain. Not broken, but will get harder to navigate as it grows past the current secondary-module set.

## 6. Security Issues

- No secrets found committed to git history (verified: `.env` never tracked, `.gitignore` correctly excludes `.env`, `.env.*`, `*.db`).
- Auth: PBKDF2-HMAC-SHA256 with per-user salt, custom bearer-token sessions with 30-day sliding expiry, token rotation on login — reasonable for this stage, not a vulnerability.
- CORS is now environment-scoped (fixed from a prior `allow_origins=["*"]` + credentials bug).
- Default Docker Compose Postgres password (`tenderos123`) is a real risk **only if this compose file is ever pointed at a public-facing deployment as-is** — flagged above, not urgent while staying on WSL2 staging per the user's stated deployment stance.
- No rate limiting bypass or injection issues found in the files reviewed; `slowapi` is used for auth endpoints (5/min signup, 10/min login).

## 7. UX Issues

- **The single biggest UX gap given the product vision in this brief**: none of what's built qualifies as "AI asks the user smart follow-up questions" during analysis. The Knowledge Base is a manually-filled JSON form (past projects/team/equipment/certs) that the user fills in *once, upfront, disconnected from any specific tender* — not the tender-triggered conversational elicitation described in the brief ("Which similar projects have you completed?" asked *in the context of this tender's requirements*). The Proposal Wizard and Bid Strategy engine consume the KB as static context; they don't interrogate its gaps against a specific tender's requirements and ask.
- Secondary modules (Teams, Approvals, Comments/Tasks, Vendor CRM, Contracts) are fully built but completely invisible via a single boolean flag — correct call per the prior audit (solo bidder doesn't need team governance yet), but it means real UI-layer weight exists that nobody is testing or maintaining attention on. Worth periodically re-checking they still build/render if `SECONDARY_MODULES_ENABLED` is flipped, since drift is invisible.
- No visible "guided workflow" (Upload → AI Understanding → Company Profile → Capability Match → Bid Decision → Proposal → Compliance Review → Final Submission) as a linear stepper — the product vision in this brief calls for this explicitly; today's UI is closer to a set of parallel panels (Tender Detail tabs) than a wizard.

## 8. Missing Procurement Features (relative to the brief's 21-item vision)

Present in some form: Tender Intelligence, Compliance Management (matrix), Document Management (KB + validator), basic Proposal Automation, basic Vendor Management (flagged off), Contract Management (flagged off), AI Procurement Assistant, early Company Capability Matching (via KB + Bid Strategy), Bid/No-Bid signal (via `bid_recommendation` + bid score).

Not present at all: Tender Discovery beyond 3 scrapers (no e-GP coverage outside Bangladesh, no manual "watch this portal" capability), formal Opportunity Qualification step, Approval Workflow (flagged off, not gone), Organization Knowledge Base in the *rich* sense the brief describes (personnel CVs, certifications-as-documents, structured project-experience records — today it's one JSON blob, not structured entities), Team Collaboration (flagged off), Procurement Planning, Spend Analysis, Supplier Evaluation (scoring), Procurement Analytics, true Multi-Agent orchestration (today: one Gemini client called from several different prompt-builders — reasonable for this stage, not agents), full Multi-Tenant SaaS (Organizations exist and are used for scoping, but there's no billing/plan-per-org separation from per-user plan fields, no admin console).

## 9. Database Limitations

- `User.knowledge_base` is an unstructured JSON text blob — fine for MVP speed, but blocks anything that needs to query/join against personnel, certifications, or past projects individually (e.g. "which of our past projects match this tender's sector" can't be done in SQL, has to be done by stuffing the whole blob into a prompt and hoping Gemini extracts the right piece).
- No `Personnel`, `Certification`, or `ProjectExperience` tables — the brief's "Organization AI Memory" vision needs these to be structured, queryable entities, not blob fields.
- `Tender.bid_score` and the various `*_analysis`/`*_draft` text columns are all free-text blobs from Gemini — fine given the parser-coupling design, but means no structured/queryable scoring breakdown (eligibility match %, capability match %, etc. as the brief's "Bid Readiness Score" concept requires) exists in the schema today; it would have to be added as new structured columns or a new table.
- `DiscoveredTender.country` defaults to `"Bangladesh"` — a hardcoded assumption baked into the schema, relevant to the brief's "must be global-ready" instruction; low cost to fix now (make it a required field with no default), rising cost later.

## 10. AI Limitations

- Every Gemini call happens inline per-request; no caching of repeated analysis, no embeddings/RAG despite the AI Assistant needing to ground answers in a (currently capped at 18,000 char) raw document — long tenders get truncated context, not retrieved-on-demand context.
- No "AI asks smart follow-up questions" loop exists (see UX section) — this is arguably the single most-differentiating item in the brief's WOW vision and it's the one piece with zero code today.
- **Confirmed, not just suspected: the Proposal Wizard prompt (`_build_proposal_prompt` in `hermes_client.py`) literally asks Gemini for `WIN PROBABILITY: [0-100]` with a `CONFIDENCE LEVEL`.** This is a direct, verified contradiction of this brief's own explicit instruction: *"Do NOT present an invented 'probability of winning' as if it were a scientifically accurate prediction. Instead design a transparent 'BID STRENGTH / COMPETITIVENESS SCORE' based on explainable factors."* The prompt does also ask for a `TECHNICAL SCORE`/`COMMERCIAL SCORE`/`EXPERIENCE SCORE`/`COMPLIANCE SCORE` breakdown, which is closer to the brief's explainable-factors intent, but it's presented *alongside*, not *instead of*, the win-probability framing. This is a concrete, low-effort fix (rename/reframe the output block) worth doing early, since it's the platform actively doing the exact thing the product vision warns against.
- Missing-information handling uses `[TO BE FILLED]` / `[Company Name]`-style bracket placeholders, not the brief's specific `[REQUIRED USER INPUT]` / `[DOCUMENT REQUIRED]` convention — same spirit, different literal tags. There is no explicit "never invent experience/certifications/clients" instruction in the prompt text itself; the placeholder pattern relies on Gemini not fabricating rather than instructing it not to. Worth an explicit anti-fabrication instruction given how much this brief emphasizes it.
- Single-provider lock-in to Gemini 2.5 Flash — reasonable given "don't add tech without reason," but the brief's future-tech section explicitly names OpenAI/Anthropic as options; no abstraction layer exists to swap providers if Gemini pricing/availability changes.

## 11. Scalability Limitations

- SQLite is dev-only (correct, documented), Postgres in Docker — fine for current single-staging-server stance.
- No background job queue beyond APScheduler in-process jobs (fine at current scale; would need Celery/RQ + Redis if discovery/notification volume grows).
- No object storage — uploaded tender documents are processed in-memory/on-request, not persisted as files (only extracted text is stored in `Tender.original_text`). This matches the brief's document-intelligence ambitions (scanned PDFs, OCR) reasonably today but blocks any "re-view original PDF" feature later.

## 12. Multilingual Limitations

- English/Bangla is implemented as hardcoded string pairs across every component (per the 5 translation-tier commits), not an i18n framework (no `next-intl`/`i18next`). This directly conflicts with the brief's explicit instruction: *"Design language handling cleanly... Future languages should be addable without rewriting the application... Do not hard-code English/Bangla throughout components."* This is the clearest brief-vs-implementation mismatch found in this audit.
- AI analysis language selection is clean (`_LANG_INSTRUCTION` dict in `hermes_client.py`, headings always English for parser stability) — that part follows the brief's spirit even if the UI layer doesn't.

## 13. Deployment Limitations

- Per prior-session memory, the user has deliberately chosen to stay on WSL2 staging rather than deploy to production — this audit does not treat "no production deploy target" as a defect, per that stated stance.
- No CI/CD pipeline (noted above).
- Docker Compose default credentials are staging-appropriate, not production-appropriate (noted above).

---

## 14. Recommended Architecture (near-term, not a rewrite)

The stack itself (Next.js + FastAPI + PostgreSQL, per the brief's own instinct) is right and shouldn't change. Recommended near-term structural moves, roughly in priority order:

1. **Rewrite `CLAUDE.md` and `README.md` to match reality.** This is nearly free and fixes the single biggest source of future wasted effort (including in this very session, which started by having to re-derive the actual architecture from scratch).
2. **Pick one migration system.** Either commit to Alembic-only (drop `ensure_schema()`, require `alembic upgrade head` on deploy) or keep `ensure_schema()` as the source of truth and demote Alembic to generated-but-unused scaffolding. Running both indefinitely is the kind of thing that causes a silent divergence bug eventually.
3. **Structure the Knowledge Base as real tables** (`Personnel`, `Certification`, `ProjectExperience`, keeping `Organization`/`User` as they are) — this is the prerequisite for the brief's "Company Memory" vision and for any real capability-matching math (today it's all inside one Gemini prompt call, unauditable and unqueryable).
4. **Add a structured scoring table or columns** for the brief's "Bid Readiness Score" concept (eligibility match %, capability match %, document readiness %, risk level as explainable *numbers*, not just free text) — needed before the brief's explainable-scoring vision can be built at all.
5. Leave the 4 flagged-off secondary modules alone. They're not technical debt — they're correctly-scoped-out, working code waiting for a real team customer.

## 15. Recommended MVP Scope (see PRODUCT_STRATEGY.md for the full reasoning)

Given how much is already built, the MVP question isn't "what to build" anymore — it's "what's the smallest next slice that closes the gap between what exists and the brief's actual differentiator" (AI Bid Intelligence + AI Proposal Copilot with company memory, explainable scoring, and a WOW guided workflow). That slice, in priority order:
1. Company Memory as structured data (not JSON blob) — unlocks everything downstream.
2. Explainable Bid Readiness Score (structured, not prose-only).
3. Tender-triggered smart follow-up questions (the AI asking *the user*, grounded in a specific tender's gaps against the Knowledge Base) — the single most novel, unbuilt piece of the brief's vision.
4. A guided-workflow UI layer over the existing panels (stepper: Upload → Understand → Match → Decide → Draft → Review → Submit) rather than new backend capability — mostly frontend/UX work reusing what already exists.

Full detail in `PRODUCT_STRATEGY.md`.

## 16. Recommended Future Roadmap

See `PRODUCT_STRATEGY.md` §11–12 and the phased plan at the end of the summary response — not duplicated here to avoid two sources of truth for the same roadmap.
