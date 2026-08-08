"use client";

import { useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader, Target, TrendingUp, XCircle } from "lucide-react";
import { API_URL } from "../api";
import type { TenderDetail } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type BidStrategyKey = keyof (typeof translations)["en"]["bidStrategy"];

const STRATEGY_KEY: Record<string, BidStrategyKey> = {
  SUBMIT: "strategySubmit",
  CONDITIONAL: "strategyConditional",
  WITHDRAW: "strategyWithdraw",
};

const RISK_KEY: Record<string, BidStrategyKey> = {
  HIGH: "riskHigh",
  MEDIUM: "riskMedium",
  LOW: "riskLow",
};

type Props = {
  tender: TenderDetail;
  token: string;
  onSaved: (strategy: string) => void;
};

type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | null;

type BidIntelligence = {
  matchScore: number;
  strategy: "SUBMIT" | "CONDITIONAL" | "WITHDRAW" | null;
  recommendedPrice: string | null;
  marketPrice: string | null;
  margin: string | null;
  confidence: number;
  competitionLevel: RiskLevel;
  priceRisk: RiskLevel;
  complianceScore: number;
  totalReqs: number;
  metReqs: number;
  partialReqs: number;
  missingReqs: number;
  technicalRisk: RiskLevel;
  financialRisk: RiskLevel;
  legalRisk: RiskLevel;
  operationalRisk: RiskLevel;
  marketRisk: RiskLevel;
  matchReasons: string[];
  criticalGaps: string[];
  missingItems: string[];
  actions: string[];
  executiveBrief: string;
  priceBreakdown: string;
  priceStrategy: string;
};

function extract(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  return m ? m[1].trim() : null;
}

function extractNum(text: string, pattern: RegExp): number {
  const v = extract(text, pattern);
  return v ? (parseInt(v) || 0) : 0;
}

function extractList(text: string, startLabel: string, endLabel: string): string[] {
  const si = text.indexOf(startLabel);
  if (si === -1) return [];
  const after = text.slice(si + startLabel.length);
  const ei = endLabel ? after.indexOf(endLabel) : -1;
  const section = ei === -1 ? after : after.slice(0, ei);
  return section
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 5 && !/^[A-Z ]+:/.test(l));
}

function extractBlock(text: string, startLabel: string, endLabel: string): string {
  const si = text.indexOf(startLabel);
  if (si === -1) return "";
  const after = text.slice(si + startLabel.length);
  const ei = endLabel ? after.indexOf(endLabel) : -1;
  return (ei === -1 ? after : after.slice(0, ei)).trim();
}

function parseBidIntelligence(text: string): BidIntelligence {
  return {
    matchScore: extractNum(text, /MATCH SCORE:\s*(\d+)/i),
    strategy: (extract(text, /BID STRATEGY:\s*(SUBMIT|CONDITIONAL|WITHDRAW)/i) as any) || null,
    recommendedPrice: extract(text, /RECOMMENDED PRICE:\s*([^\n]+)/i),
    marketPrice: extract(text, /ESTIMATED MARKET PRICE:\s*([^\n]+)/i),
    margin: extract(text, /SUGGESTED MARGIN:\s*([^\n]+)/i),
    confidence: extractNum(text, /BID CONFIDENCE:\s*(\d+)/i),
    competitionLevel: (extract(text, /COMPETITION LEVEL:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    priceRisk: (extract(text, /PRICE RISK:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    complianceScore: extractNum(text, /COMPLIANCE SCORE:\s*(\d+)/i),
    totalReqs: extractNum(text, /Total Requirements:\s*(\d+)/i),
    metReqs: extractNum(text, /Fully Met:\s*(\d+)/i),
    partialReqs: extractNum(text, /Partially Met:\s*(\d+)/i),
    missingReqs: extractNum(text, /^Missing:\s*(\d+)/im),
    technicalRisk: (extract(text, /Technical Risk:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    financialRisk: (extract(text, /Financial Risk:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    legalRisk: (extract(text, /Legal Risk:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    operationalRisk: (extract(text, /Operational Risk:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    marketRisk: (extract(text, /Market Risk:\s*(HIGH|MEDIUM|LOW)/i) as any) || null,
    matchReasons: extractList(text, "MATCH REASONS:\n", "CRITICAL GAPS:"),
    criticalGaps: extractList(text, "CRITICAL GAPS:\n", "PRICE BREAKDOWN:"),
    missingItems: extractList(text, "Missing Requirements:\n", "RISK ASSESSMENT:"),
    actions: extractList(text, "RECOMMENDED ACTIONS:\n", "EXECUTIVE BRIEF:"),
    executiveBrief: extractBlock(text, "EXECUTIVE BRIEF:\n", ""),
    priceBreakdown: extractBlock(text, "PRICE BREAKDOWN:\n", "PRICE STRATEGY:"),
    priceStrategy: extractBlock(text, "PRICE STRATEGY:\n", "COMPLIANCE ASSESSMENT:"),
  };
}

function riskColor(level: RiskLevel): string {
  if (level === "HIGH") return "#dc2626";
  if (level === "MEDIUM") return "#d97706";
  if (level === "LOW") return "#16a34a";
  return "#94a3b8";
}

function riskBg(level: RiskLevel): string {
  if (level === "HIGH") return "#ffe9e9";
  if (level === "MEDIUM") return "#fff2d8";
  if (level === "LOW") return "#e3f7ef";
  return "#f1f5f9";
}

function strategyColor(s: string | null) {
  if (s === "SUBMIT") return { bg: "#e3f7ef", color: "#16a34a" };
  if (s === "CONDITIONAL") return { bg: "#fff2d8", color: "#d97706" };
  if (s === "WITHDRAW") return { bg: "#ffe9e9", color: "#dc2626" };
  return { bg: "#edf1f7", color: "#48566b" };
}

function scoreRingColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const RISK_ROWS: { key: keyof BidIntelligence; labelKey: BidStrategyKey }[] = [
  { key: "technicalRisk",   labelKey: "riskTechnical" },
  { key: "financialRisk",   labelKey: "riskFinancial" },
  { key: "legalRisk",       labelKey: "riskLegal" },
  { key: "operationalRisk", labelKey: "riskOperational" },
  { key: "marketRisk",      labelKey: "riskMarket" },
];

export function BidStrategyPanel({ tender, token, onSaved }: Props) {
  const { t } = useLanguage();
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(tender.language || "english");
  const [localStrategy, setLocalStrategy] = useState(tender.bid_strategy || "");

  async function run() {
    setGenerating(true);
    setError("");
    setStreamText("");

    const form = new FormData();
    form.append("language", language);

    try {
      const response = await fetch(`${API_URL}/tenders/${tender.id}/bid-strategy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail ?? t("bidStrategy", "generationFailed"));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(t("bidStrategy", "noStream"));
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const p = JSON.parse(line.slice(6));
              if (p.text) { full += p.text; setStreamText(full); }
            } catch { /* skip */ }
          }
        }
      }
      setLocalStrategy(full);
      onSaved(full);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("bidStrategy", "genericFailed"));
    } finally {
      setGenerating(false);
    }
  }

  const intel = localStrategy ? parseBidIntelligence(localStrategy) : null;
  const sc = intel ? strategyColor(intel.strategy) : null;

  if (!localStrategy && !generating) {
    return (
      <section className="surface strategy-empty">
        <div className="strategy-empty-icon"><Target size={36} /></div>
        <div>
          <h3>{t("bidStrategy", "advisorHeading")}</h3>
          <p className="muted">{t("bidStrategy", "advisorBody")}</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ width: "auto", marginTop: 0 }}
            >
              <option value="english">English</option>
              <option value="bangla">বাংলা</option>
            </select>
            <button className="primary" onClick={run}>
              <BrainCircuit size={16} /> {t("bidStrategy", "runButton")}
            </button>
          </div>
          {error && <p className="notice error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </section>
    );
  }

  if (generating) {
    return (
      <section className="surface strategy-generating">
        <div className="stream-status">
          <Loader size={16} className="spinning" />
          {t("bidStrategy", "generatingStatus")}
        </div>
        <textarea className="stream-output" readOnly value={streamText} style={{ minHeight: 180, fontSize: 12 }} />
      </section>
    );
  }

  if (!intel) return null;

  return (
    <section className="surface bid-intelligence">
      {/* Header */}
      <div className="bi-header">
        <div>
          <p className="eyebrow">{t("bidStrategy", "eyebrow")}</p>
          <h2>{t("bidStrategy", "heading")}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "auto", marginTop: 0 }}>
            <option value="english">English</option>
            <option value="bangla">বাংলা</option>
          </select>
          <button onClick={run} disabled={generating}>
            <BrainCircuit size={15} /> {t("bidStrategy", "refreshButton")}
          </button>
        </div>
      </div>

      {/* Top KPI row */}
      <div className="bi-kpi-row">
        {/* Match Score */}
        <div className="bi-kpi-card">
          <div className="bi-ring" style={{ "--ring-color": scoreRingColor(intel.matchScore) } as React.CSSProperties}>
            <span className="bi-ring-num">{intel.matchScore}</span>
            <span className="bi-ring-sub">/100</span>
          </div>
          <div>
            <p className="bi-kpi-label">{t("bidStrategy", "matchScoreLabel")}</p>
            <p className="bi-kpi-sub muted">{t("bidStrategy", "matchScoreSub")}</p>
          </div>
        </div>

        {/* Strategy decision */}
        {intel.strategy && sc && (
          <div className="bi-strategy-badge" style={{ background: sc.bg, color: sc.color }}>
            {intel.strategy === "SUBMIT" && <CheckCircle2 size={22} />}
            {intel.strategy === "CONDITIONAL" && <AlertTriangle size={22} />}
            {intel.strategy === "WITHDRAW" && <XCircle size={22} />}
            <div>
              <p className="bi-strategy-label">{t("bidStrategy", "strategyLabel")}</p>
              <strong className="bi-strategy-decision">{t("bidStrategy", STRATEGY_KEY[intel.strategy])}</strong>
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="bi-kpi-card">
          <div className="bi-ring" style={{ "--ring-color": scoreRingColor(intel.confidence) } as React.CSSProperties}>
            <span className="bi-ring-num">{intel.confidence}</span>
            <span className="bi-ring-sub">%</span>
          </div>
          <div>
            <p className="bi-kpi-label">{t("bidStrategy", "confidenceLabel")}</p>
            <p className="bi-kpi-sub muted">{t("bidStrategy", "confidenceSub")}</p>
          </div>
        </div>

        {/* Competition level */}
        {intel.competitionLevel && (
          <div className="bi-kpi-flat" style={{ background: riskBg(intel.competitionLevel) }}>
            <p className="bi-kpi-label">{t("bidStrategy", "competitionLabel")}</p>
            <strong style={{ color: riskColor(intel.competitionLevel) }}>{t("bidStrategy", RISK_KEY[intel.competitionLevel])}</strong>
          </div>
        )}
      </div>

      {/* Price Intelligence */}
      {(intel.recommendedPrice || intel.marketPrice || intel.margin) && (
        <div className="bi-section">
          <h3 className="bi-section-title"><TrendingUp size={16} /> {t("bidStrategy", "priceIntelligenceTitle")}</h3>
          <div className="bi-price-grid">
            {intel.recommendedPrice && (
              <div className="bi-price-card blue">
                <span>{t("bidStrategy", "recommendedRangeLabel")}</span>
                <strong>{intel.recommendedPrice}</strong>
              </div>
            )}
            {intel.marketPrice && (
              <div className="bi-price-card green">
                <span>{t("bidStrategy", "marketPriceLabel")}</span>
                <strong>{intel.marketPrice}</strong>
              </div>
            )}
            {intel.margin && (
              <div className="bi-price-card amber">
                <span>{t("bidStrategy", "marginLabel")}</span>
                <strong>{intel.margin}</strong>
              </div>
            )}
            {intel.priceRisk && (
              <div className="bi-price-card" style={{ borderColor: riskColor(intel.priceRisk), background: riskBg(intel.priceRisk) }}>
                <span>{t("bidStrategy", "priceRiskLabel")}</span>
                <strong style={{ color: riskColor(intel.priceRisk) }}>{t("bidStrategy", RISK_KEY[intel.priceRisk])}</strong>
              </div>
            )}
          </div>
          {intel.priceStrategy && (
            <p className="bi-price-note">{intel.priceStrategy}</p>
          )}
        </div>
      )}

      {/* Compliance Engine */}
      {intel.complianceScore > 0 && (
        <div className="bi-section">
          <h3 className="bi-section-title"><CheckCircle2 size={16} /> {t("bidStrategy", "complianceTitle")}</h3>
          <div className="bi-compliance">
            <div className="bi-compliance-score">
              <div className="compliance-bar-wrap">
                <div
                  className="compliance-bar-fill"
                  style={{
                    width: `${intel.complianceScore}%`,
                    background: scoreRingColor(intel.complianceScore),
                  }}
                />
              </div>
              <span className="compliance-pct" style={{ color: scoreRingColor(intel.complianceScore) }}>
                {intel.complianceScore}%
              </span>
            </div>
            <div className="bi-compliance-counts">
              {intel.totalReqs > 0 && <div className="comp-chip total">{t("bidStrategy", "totalLabel")} {intel.totalReqs}</div>}
              {intel.metReqs > 0 && <div className="comp-chip met">{t("bidStrategy", "metLabel")} {intel.metReqs}</div>}
              {intel.partialReqs > 0 && <div className="comp-chip partial">{t("bidStrategy", "partialLabel")} {intel.partialReqs}</div>}
              {intel.missingReqs > 0 && <div className="comp-chip missing">{t("bidStrategy", "missingLabel")} {intel.missingReqs}</div>}
            </div>
            {intel.missingItems.length > 0 && (
              <div className="bi-missing-list">
                <strong>{t("bidStrategy", "missingRequirementsLabel")}</strong>
                <ul>
                  {intel.missingItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Heatmap */}
      <div className="bi-section">
        <h3 className="bi-section-title"><AlertTriangle size={16} /> {t("bidStrategy", "riskHeatmapTitle")}</h3>
        <div className="risk-heatmap">
          {RISK_ROWS.map(({ key, labelKey }) => {
            const level = intel[key] as RiskLevel;
            if (!level) return null;
            const barWidth = level === "HIGH" ? 90 : level === "MEDIUM" ? 55 : 25;
            return (
              <div key={key} className="risk-row">
                <span className="risk-label">{t("bidStrategy", labelKey)}</span>
                <div className="risk-bar-track">
                  <div
                    className="risk-bar-fill"
                    style={{ width: `${barWidth}%`, background: riskColor(level) }}
                  />
                </div>
                <span className="risk-badge" style={{ background: riskBg(level), color: riskColor(level) }}>
                  {t("bidStrategy", RISK_KEY[level])}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: Match reasons + Gaps */}
      <div className="bi-two-col">
        {intel.matchReasons.length > 0 && (
          <div className="bi-section">
            <h3 className="bi-section-title"><CheckCircle2 size={16} /> {t("bidStrategy", "whyYouMatchTitle")}</h3>
            <ul className="bi-list green">
              {intel.matchReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
        {intel.criticalGaps.length > 0 && (
          <div className="bi-section">
            <h3 className="bi-section-title"><XCircle size={16} /> {t("bidStrategy", "criticalGapsTitle")}</h3>
            <ul className="bi-list red">
              {intel.criticalGaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Recommended Actions */}
      {intel.actions.length > 0 && (
        <div className="bi-section">
          <h3 className="bi-section-title">{t("bidStrategy", "recommendedActionsTitle")}</h3>
          <ol className="bi-actions">
            {intel.actions.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </div>
      )}

      {/* Executive Brief */}
      {intel.executiveBrief && (
        <div className="bi-section bi-executive">
          <h3 className="bi-section-title">{t("bidStrategy", "executiveBriefTitle")}</h3>
          <p>{intel.executiveBrief}</p>
        </div>
      )}

      {error && <p className="notice error">{error}</p>}
    </section>
  );
}
