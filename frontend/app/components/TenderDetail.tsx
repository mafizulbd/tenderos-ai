"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, BrainCircuit, FileSearch, FileSignature, RefreshCw, Save, UploadCloud } from "lucide-react";
import { API_URL, apiRequest } from "../api";
import { formatBytes, formatDate } from "../utils";
import { Section } from "./Section";
import { ProposalWizard } from "./ProposalWizard";
import { BidStrategyPanel } from "./BidStrategyPanel";
import { KbGapPanel } from "./KbGapPanel";
import { TenderStepper } from "./TenderStepper";
import { AssistantPanel } from "./AssistantPanel";
import { ApprovalPanel } from "./ApprovalPanel";
import { CommentsPanel } from "./CommentsPanel";
import { TasksPanel } from "./TasksPanel";
import { LinkedVendorsPanel } from "./LinkedVendorsPanel";
import type { KbGapQuestion, Organization, TenderDetail as TDetail } from "../types";
import { SECONDARY_MODULES_ENABLED } from "../features";
import { useLanguage, type TFunction } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type LibraryKey = keyof (typeof translations)["en"]["library"];

const BID_STATUSES: { value: string; labelKey: LibraryKey }[] = [
  { value: "reviewing",  labelKey: "statusReviewing" },
  { value: "submitted",  labelKey: "statusSubmitted" },
  { value: "won",        labelKey: "statusWon" },
  { value: "lost",       labelKey: "statusLost" },
  { value: "no-bid",     labelKey: "statusNoBid" },
];

type Props = {
  tender: TDetail;
  token: string;
  organization: Organization | null;
  currentUserId: number;
  onUpdated: (tender: TDetail) => void;
  onTendersChanged: () => void;
};

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function scoreLabel(score: number, t: TFunction): string {
  if (score >= 80) return t("detail", "scoreStrongFit");
  if (score >= 60) return t("detail", "scoreViable");
  if (score >= 40) return t("detail", "scoreNeedsWork");
  return t("detail", "scoreNotViable");
}

function extractDecision(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/BID DECISION:\s*(\w[\w -]*)/i);
  return m ? m[1].trim() : null;
}

export function TenderDetail({ tender, token, organization, currentUserId, onUpdated, onTendersChanged }: Props) {
  const { t } = useLanguage();
  const [reanalyzing, setReanalyzing] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [reanalyzeLanguage, setReanalyzeLanguage] = useState(tender.language);
  const [bidStatus, setBidStatus] = useState(tender.bid_status);
  const [notes, setNotes] = useState(tender.notes ?? "");
  const [localProposal, setLocalProposal] = useState(tender.personalized_proposal);
  const [localStrategy, setLocalStrategy] = useState(tender.bid_strategy);
  const [localGapQuestions, setLocalGapQuestions] = useState(tender.kb_gap_questions);
  const [error, setError] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractMessage, setContractMessage] = useState("");
  const [contractCreated, setContractCreated] = useState(false);

  const busy = reanalyzing || downloadingDocx || downloadingPdf || savingNotes;
  const decision = extractDecision(tender.bid_recommendation);
  const canModify =
    organization?.role === "owner" || organization?.role === "admin" || tender.user_id === currentUserId;

  async function reanalyze() {
    setReanalyzing(true);
    setError("");
    try {
      const updated = await apiRequest<TDetail>(`/tenders/${tender.id}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: reanalyzeLanguage }),
      }, token);
      onUpdated(updated);
      await onTendersChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("detail", "reanalyzeFailed"));
    } finally {
      setReanalyzing(false);
    }
  }

  async function saveStatus() {
    setSavingNotes(true);
    setError("");
    try {
      const updated = await apiRequest<TDetail>(`/tenders/${tender.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid_status: bidStatus, notes }),
      }, token);
      onUpdated(updated);
      await onTendersChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("detail", "saveFailed"));
    } finally {
      setSavingNotes(false);
    }
  }

  async function createContract() {
    setCreatingContract(true);
    setContractMessage("");
    setContractCreated(false);
    try {
      await apiRequest("/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Contract: ${tender.title}`, tender_id: tender.id }),
      }, token);
      setContractCreated(true);
    } catch (err: unknown) {
      setContractMessage(err instanceof Error ? err.message : t("detail", "createContractFailed"));
    } finally {
      setCreatingContract(false);
    }
  }

  async function downloadFile(endpoint: string, filename: string, setLoading: (v: boolean) => void) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/tenders/${tender.id}/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail ?? t("detail", "downloadFailed"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("detail", "downloadFailed"));
    } finally {
      setLoading(false);
    }
  }

  const stepperTender: TDetail = {
    ...tender,
    bid_status: bidStatus,
    personalized_proposal: localProposal,
    bid_strategy: localStrategy,
    kb_gap_questions: localGapQuestions,
  };

  return (
    <>
      <TenderStepper tender={stepperTender} />

      <section id="tender-header" className="surface detail-header">
        <div>
          <p className="eyebrow">{t("detail", "selectedTender")}</p>
          <h2>{tender.title}</h2>
          <p className="muted">
            {tender.file_name} &nbsp;·&nbsp; {formatBytes(tender.file_size)} &nbsp;·&nbsp; {tender.language}
            {tender.deadline && (
              <> &nbsp;·&nbsp; {t("detail", "deadlineLabel")} <strong>{formatDate(tender.deadline)}</strong></>
            )}
          </p>
        </div>

        <div className="detail-actions">
          <select
            value={reanalyzeLanguage}
            onChange={(e) => setReanalyzeLanguage(e.target.value)}
            disabled={busy}
            title={t("detail", "reanalyzeLanguageTitle")}
          >
            <option value="english">English</option>
            <option value="bangla">বাংলা</option>
          </select>

          <button onClick={reanalyze} disabled={busy} title={t("detail", "reanalyzeTitle")}>
            <RefreshCw size={16} className={reanalyzing ? "spinning" : ""} />
            {reanalyzing ? t("detail", "reanalyzing") : t("detail", "reanalyze")}
          </button>

          <button
            onClick={() =>
              downloadFile(
                "export-docx",
                `tender_${tender.id}_report.docx`,
                setDownloadingDocx,
              )
            }
            disabled={busy}
          >
            <ArrowDownToLine size={16} />
            {downloadingDocx ? "..." : "DOCX"}
          </button>

          <button
            onClick={() =>
              downloadFile(
                "export-pdf",
                `tender_${tender.id}_report.pdf`,
                setDownloadingPdf,
              )
            }
            disabled={busy}
          >
            <ArrowDownToLine size={16} />
            {downloadingPdf ? "..." : "PDF"}
          </button>

          <button
            className="primary"
            onClick={() => setShowWizard(true)}
            disabled={busy}
            title={t("detail", "aiProposalButtonTitle")}
          >
            <BrainCircuit size={16} />
            {t("detail", "aiProposalButton")}
          </button>
        </div>
      </section>

      {showWizard && (
        <ProposalWizard
          tender={tender}
          token={token}
          onComplete={(proposal) => {
            setLocalProposal(proposal);
            setShowWizard(false);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {error && <p className="notice error">{error}</p>}

      {/* Bid score card */}
      {tender.bid_score !== null && (
        <section className="surface bid-score-card">
          <div className="score-ring" style={{ "--score-color": scoreColor(tender.bid_score) } as React.CSSProperties}>
            <span className="score-number">{tender.bid_score}</span>
            <span className="score-denom">/100</span>
          </div>
          <div className="score-info">
            <strong style={{ color: scoreColor(tender.bid_score) }}>{scoreLabel(tender.bid_score, t)}</strong>
            {decision && (
              <span className={`decision-badge ${decision.toLowerCase().replace(" ", "-")}`}>
                {decision}
              </span>
            )}
            <p className="muted">{t("detail", "aiScoreCaption")}</p>
          </div>
        </section>
      )}

      {/* Status & notes panel */}
      <section id="tender-review" className="surface status-notes-panel">
        <div className="status-notes-header">
          <h3>{t("detail", "bidTracking")}</h3>
          <button onClick={saveStatus} disabled={busy} className="save-btn">
            <Save size={15} />
            {savingNotes ? t("detail", "saving") : t("detail", "save")}
          </button>
        </div>

        <div className="field-row">
          <label>
            {t("detail", "bidStatusLabel")}
            <select value={bidStatus} onChange={(e) => setBidStatus(e.target.value)} disabled={busy}>
              {BID_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{t("library", s.labelKey)}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          {t("detail", "internalNotesLabel")}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t("detail", "notesPlaceholder")}
            disabled={busy}
          />
        </label>

        {SECONDARY_MODULES_ENABLED && tender.bid_status === "won" && canModify && (
          <div className="detail-actions" style={{ marginTop: "0.75rem" }}>
            <button onClick={createContract} disabled={creatingContract}>
              <FileSignature size={16} />
              {creatingContract ? t("detail", "creatingContract") : t("detail", "createContract")}
            </button>
          </div>
        )}
        {SECONDARY_MODULES_ENABLED && contractMessage && <p className="notice error">{contractMessage}</p>}
        {SECONDARY_MODULES_ENABLED && contractCreated && (
          <p className="notice">
            {t("detail", "contractCreatedPrefix")} <Link href="/dashboard/contracts">{t("detail", "contractCreatedLink")}</Link>.
          </p>
        )}
      </section>

      {SECONDARY_MODULES_ENABLED && (
        <>
          <ApprovalPanel
            tender={tender}
            token={token}
            organization={organization}
            onUpdated={onUpdated}
          />

          <LinkedVendorsPanel
            tenderId={tender.id}
            token={token}
            canModify={canModify}
          />

          <TasksPanel
            entityType="tender"
            entityId={tender.id}
            token={token}
            currentUserId={currentUserId}
          />

          <CommentsPanel
            entityType="tender"
            entityId={tender.id}
            token={token}
            currentUserId={currentUserId}
            organization={organization}
          />
        </>
      )}

      <div id="tender-match">
        <KbGapPanel
          tender={{ ...tender, kb_gap_questions: localGapQuestions }}
          token={token}
          onSaved={(q: KbGapQuestion[]) => setLocalGapQuestions(q)}
        />
      </div>

      <div id="tender-decide">
        <BidStrategyPanel
          tender={{ ...tender, bid_strategy: localStrategy }}
          token={token}
          onSaved={(s) => setLocalStrategy(s)}
        />
      </div>

      <div id="tender-understand">
        <Section title={t("sections", "summary")}            content={tender.summary} />
        <Section title={t("sections", "eligibility")}        content={tender.eligibility} />
        <Section title={t("sections", "financial")}          content={tender.financial_requirements} />
        <Section title={t("sections", "requiredDocuments")}  content={tender.required_documents} />
        <Section title={t("sections", "complianceMatrix")}   content={tender.compliance_matrix} />
        <Section title={t("sections", "riskAnalysis")}       content={tender.risk_analysis} />
        <Section title={t("sections", "bidRecommendation")}  content={tender.bid_recommendation} />
        <Section title={t("sections", "submissionDraft")}    content={tender.proposal_draft} />
        <Section title={t("sections", "finalChecklist")}     content={tender.final_checklist} />
      </div>

      {/* AI Personalized Proposal */}
      <div id="tender-draft">
      {localProposal ? (
        <section className="surface proposal-section">
          <div className="proposal-section-header">
            <div>
              <p className="eyebrow">{t("detail", "aiGeneratedEyebrow")}</p>
              <h3>{t("detail", "personalizedProposalHeading")}</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {t("detail", "personalizedProposalSubtitle")}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => setShowWizard(true)}
              title={t("detail", "regenerateProposalTitle")}
            >
              <BrainCircuit size={15} />
              {t("detail", "regenerate")}
            </button>
          </div>
          <pre className="proposal-text">{localProposal}</pre>
        </section>
      ) : (
        <section className="surface proposal-cta">
          <BrainCircuit size={32} className="proposal-cta-icon" />
          <div>
            <h3>{t("detail", "generateProposalHeading")}</h3>
            <p className="muted">{t("detail", "generateProposalBody")}</p>
          </div>
          <button className="primary" onClick={() => setShowWizard(true)}>
            <BrainCircuit size={16} />
            {t("detail", "generateProposalButton")}
          </button>
        </section>
      )}
      </div>

      <AssistantPanel tenderId={tender.id} token={token} />
    </>
  );
}

export function TenderDetailEmpty({ hasTenders }: { hasTenders: boolean }) {
  const { t } = useLanguage();

  if (!hasTenders) {
    return (
      <div className="detail-stack">
        <section className="surface empty-state">
          <FileSearch size={36} />
          <h2>{t("detail", "noTendersHeading")}</h2>
          <p className="muted">{t("detail", "noTendersBody")}</p>
          <Link href="/dashboard#analyze" className="btn-link primary" style={{ marginTop: 12 }}>
            <UploadCloud size={16} />
            {t("detail", "uploadTenderLink")}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <section className="surface empty-state">
        <FileSearch size={36} />
        <h2>{t("detail", "noTenderSelectedHeading")}</h2>
        <p className="muted">{t("detail", "noTenderSelectedBody")}</p>
      </section>

      <section className="surface proposal-cta">
        <BrainCircuit size={32} className="proposal-cta-icon" />
        <div>
          <h3>{t("detail", "wizardCtaHeading")}</h3>
          <p className="muted">
            {t("detail", "wizardCtaBodyPrefix")} <strong>{t("detail", "wizardCtaBodyBold")}</strong> {t("detail", "wizardCtaBodySuffix")}
          </p>
        </div>
      </section>
    </div>
  );
}
