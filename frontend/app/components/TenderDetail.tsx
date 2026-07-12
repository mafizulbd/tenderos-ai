"use client";

import { useState } from "react";
import { ArrowDownToLine, BrainCircuit, FileSearch, RefreshCw, Save } from "lucide-react";
import { API_URL, apiRequest } from "../api";
import { formatBytes, formatDate } from "../utils";
import { Section } from "./Section";
import { ProposalWizard } from "./ProposalWizard";
import { BidStrategyPanel } from "./BidStrategyPanel";
import { ApprovalPanel } from "./ApprovalPanel";
import { CommentsPanel } from "./CommentsPanel";
import { TasksPanel } from "./TasksPanel";
import { LinkedVendorsPanel } from "./LinkedVendorsPanel";
import type { Organization, TenderDetail as TDetail } from "../types";

const BID_STATUSES = [
  { value: "reviewing",  label: "Reviewing" },
  { value: "submitted",  label: "Submitted" },
  { value: "won",        label: "Won" },
  { value: "lost",       label: "Lost" },
  { value: "no-bid",     label: "No Bid" },
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

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong Fit";
  if (score >= 60) return "Viable";
  if (score >= 40) return "Needs Work";
  return "Not Viable";
}

function extractDecision(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/BID DECISION:\s*(\w[\w -]*)/i);
  return m ? m[1].trim() : null;
}

export function TenderDetail({ tender, token, organization, currentUserId, onUpdated, onTendersChanged }: Props) {
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
  const [error, setError] = useState("");

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
      setError(err instanceof Error ? err.message : "Re-analysis failed.");
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
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingNotes(false);
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
        throw new Error(data?.detail ?? "Download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="surface detail-header">
        <div>
          <p className="eyebrow">Selected tender</p>
          <h2>{tender.title}</h2>
          <p className="muted">
            {tender.file_name} &nbsp;·&nbsp; {formatBytes(tender.file_size)} &nbsp;·&nbsp; {tender.language}
            {tender.deadline && (
              <> &nbsp;·&nbsp; Deadline: <strong>{formatDate(tender.deadline)}</strong></>
            )}
          </p>
        </div>

        <div className="detail-actions">
          <select
            value={reanalyzeLanguage}
            onChange={(e) => setReanalyzeLanguage(e.target.value)}
            disabled={busy}
            title="Re-analyze language"
          >
            <option value="english">English</option>
            <option value="bangla">বাংলা</option>
          </select>

          <button onClick={reanalyze} disabled={busy} title="Re-analyze with selected language">
            <RefreshCw size={16} className={reanalyzing ? "spinning" : ""} />
            {reanalyzing ? "Analyzing..." : "Re-analyze"}
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
            title="Generate AI-personalized proposal using your company knowledge base"
          >
            <BrainCircuit size={16} />
            AI Proposal
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
            <strong style={{ color: scoreColor(tender.bid_score) }}>{scoreLabel(tender.bid_score)}</strong>
            {decision && (
              <span className={`decision-badge ${decision.toLowerCase().replace(" ", "-")}`}>
                {decision}
              </span>
            )}
            <p className="muted">AI Bid Recommendation Score</p>
          </div>
        </section>
      )}

      {/* Status & notes panel */}
      <section className="surface status-notes-panel">
        <div className="status-notes-header">
          <h3>Bid tracking</h3>
          <button onClick={saveStatus} disabled={busy} className="save-btn">
            <Save size={15} />
            {savingNotes ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="field-row">
          <label>
            Bid status
            <select value={bidStatus} onChange={(e) => setBidStatus(e.target.value)} disabled={busy}>
              {BID_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Internal notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this tender, bid team assignments, or submission checklist status..."
            disabled={busy}
          />
        </label>
      </section>

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

      <BidStrategyPanel
        tender={{ ...tender, bid_strategy: localStrategy }}
        token={token}
        onSaved={(s) => setLocalStrategy(s)}
      />

      <Section title="Executive Summary"          content={tender.summary} />
      <Section title="Eligibility Criteria"        content={tender.eligibility} />
      <Section title="Financial Requirements"      content={tender.financial_requirements} />
      <Section title="Required Documents"          content={tender.required_documents} />
      <Section title="Compliance Matrix"           content={tender.compliance_matrix} />
      <Section title="Risk Analysis"               content={tender.risk_analysis} />
      <Section title="Bid Recommendation"          content={tender.bid_recommendation} />
      <Section title="Tender Submission Draft"     content={tender.proposal_draft} />
      <Section title="Final Submission Checklist"  content={tender.final_checklist} />

      {/* AI Personalized Proposal */}
      {localProposal ? (
        <section className="surface proposal-section">
          <div className="proposal-section-header">
            <div>
              <p className="eyebrow">AI-Generated</p>
              <h3>Personalized Bid Proposal</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                Generated using your company knowledge base. Ready to edit and submit.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => setShowWizard(true)}
              title="Regenerate proposal"
            >
              <BrainCircuit size={15} />
              Regenerate
            </button>
          </div>
          <pre className="proposal-text">{localProposal}</pre>
        </section>
      ) : (
        <section className="surface proposal-cta">
          <BrainCircuit size={32} className="proposal-cta-icon" />
          <div>
            <h3>Generate AI Proposal</h3>
            <p className="muted">
              Get a complete, submission-ready bid proposal generated from your company knowledge base
              and this tender&apos;s requirements — including win probability assessment.
            </p>
          </div>
          <button className="primary" onClick={() => setShowWizard(true)}>
            <BrainCircuit size={16} />
            Generate Proposal
          </button>
        </section>
      )}
    </>
  );
}

export function TenderDetailEmpty() {
  return (
    <div className="detail-stack">
      <section className="surface empty-state">
        <FileSearch size={36} />
        <h2>No tender selected</h2>
        <p className="muted">Click any tender in the library on the left to open it here.</p>
      </section>

      <section className="surface proposal-cta">
        <BrainCircuit size={32} className="proposal-cta-icon" />
        <div>
          <h3>AI Proposal Wizard</h3>
          <p className="muted">
            Select a tender then click the blue <strong>AI Proposal</strong> button to generate a
            complete, submission-ready bid proposal — including Win Probability Assessment.
          </p>
        </div>
      </section>
    </div>
  );
}
