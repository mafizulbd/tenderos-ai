"use client";

import { useState } from "react";
import {
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader,
  Users,
  X,
} from "lucide-react";
import { API_URL } from "../api";
import type { TenderDetail } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type Props = {
  tender: TenderDetail;
  token: string;
  onComplete: (proposal: string) => void;
  onClose: () => void;
};

type WizardData = {
  language: string;
  bid_price: string;
  timeline: string;
  warranty: string;
  payment_terms: string;
  project_manager: string;
  methodology: string;
};

type WizardKey = keyof (typeof translations)["en"]["proposalWizard"];

type Step = {
  titleKey: WizardKey;
  descKey: WizardKey;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  { titleKey: "step1Title", descKey: "step1Desc", icon: <FileText size={20} /> },
  { titleKey: "step2Title", descKey: "step2Desc", icon: <ChevronRight size={20} /> },
  { titleKey: "step3Title", descKey: "step3Desc", icon: <Users size={20} /> },
  { titleKey: "step4Title", descKey: "step4Desc", icon: <BrainCircuit size={20} /> },
];

const PROPOSAL_SECTION_KEYS: WizardKey[] = [
  "sectionCoverLetter", "sectionCompanyIntro", "sectionUnderstanding", "sectionTechnicalApproach",
  "sectionImplementationPlan", "sectionProjectTeam", "sectionEquipmentPlan", "sectionPastProjects",
  "sectionFinancialProposal", "sectionQA", "sectionCompliance", "sectionBidStrength",
];

function extractBidReadiness(text: string): number | null {
  const m = text.match(/OVERALL BID READINESS:\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function bidReadinessColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function ProposalWizard({ tender, token, onComplete, onClose }: Props) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<WizardData>({
    language: "english",
    bid_price: "",
    timeline: "",
    warranty: "12 months",
    payment_terms: "Monthly progress payment",
    project_manager: "",
    methodology: "",
  });

  function setField(key: keyof WizardData, val: string) {
    setData((prev) => ({ ...prev, [key]: val }));
  }

  async function generate() {
    setGenerating(true);
    setStreamedText("");
    setError("");
    setDone(false);

    try {
      const response = await fetch(`${API_URL}/tenders/${tender.id}/generate-proposal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail ?? t("proposalWizard", "generationFailed"));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(t("proposalWizard", "noResponseStream"));

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) {
                full += parsed.text;
                setStreamedText(full);
              }
            } catch {
              // non-JSON SSE line, skip
            }
          }
        }
      }

      setDone(true);
      onComplete(full);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("proposalWizard", "proposalGenerationFailed"));
    } finally {
      setGenerating(false);
    }
  }

  const bidReadiness = done ? extractBidReadiness(streamedText) : null;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="wizard-overlay" onClick={(e) => e.target === e.currentTarget && !generating && onClose()}>
      <div className="wizard-modal">
        {/* Header */}
        <div className="wizard-header">
          <div>
            <p className="eyebrow">{t("proposalWizard", "eyebrow")}</p>
            <h2>{tender.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={generating}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`wizard-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => !generating && i < step && setStep(i)}
            >
              <div className="step-circle">{i < step ? "✓" : i + 1}</div>
              <span className="step-label">{t("proposalWizard", s.titleKey)}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="wizard-body">
          {step === 0 && (
            <div className="wizard-section">
              <h3>{t("proposalWizard", "step1Heading")}</h3>
              <p className="muted">{t("proposalWizard", "step1Body")}</p>
              <div className="field-row">
                <label>
                  {t("proposalWizard", "proposalLanguageLabel")}
                  <select value={data.language} onChange={(e) => setField("language", e.target.value)}>
                    <option value="english">{t("proposalWizard", "englishOption")}</option>
                    <option value="bangla">{t("proposalWizard", "banglaOption")}</option>
                  </select>
                </label>
                <label>
                  {t("proposalWizard", "bidPriceLabel")}
                  <input
                    value={data.bid_price}
                    onChange={(e) => setField("bid_price", e.target.value)}
                    placeholder={t("proposalWizard", "bidPricePlaceholder")}
                  />
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-section">
              <h3>{t("proposalWizard", "step2Heading")}</h3>
              <p className="muted">{t("proposalWizard", "step2Body")}</p>
              <div className="field-row">
                <label>
                  {t("proposalWizard", "completionTimeLabel")}
                  <input
                    value={data.timeline}
                    onChange={(e) => setField("timeline", e.target.value)}
                    placeholder={t("proposalWizard", "completionTimePlaceholder")}
                  />
                </label>
                <label>
                  {t("proposalWizard", "warrantyLabel")}
                  <input
                    value={data.warranty}
                    onChange={(e) => setField("warranty", e.target.value)}
                    placeholder={t("proposalWizard", "warrantyPlaceholder")}
                  />
                </label>
              </div>
              <label>
                {t("proposalWizard", "paymentTermsLabel")}
                <input
                  value={data.payment_terms}
                  onChange={(e) => setField("payment_terms", e.target.value)}
                  placeholder={t("proposalWizard", "paymentTermsPlaceholder")}
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-section">
              <h3>{t("proposalWizard", "step3Heading")}</h3>
              <p className="muted">{t("proposalWizard", "step3Body")}</p>
              <label>
                {t("proposalWizard", "projectManagerLabel")}
                <input
                  value={data.project_manager}
                  onChange={(e) => setField("project_manager", e.target.value)}
                  placeholder={t("proposalWizard", "projectManagerPlaceholder")}
                />
              </label>
              <label style={{ marginTop: 12 }}>
                {t("proposalWizard", "methodologyLabel")}
                <textarea
                  value={data.methodology}
                  onChange={(e) => setField("methodology", e.target.value)}
                  rows={4}
                  placeholder={t("proposalWizard", "methodologyPlaceholder")}
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-section">
              {!generating && !done && (
                <div className="wizard-generate-ready">
                  <div className="wizard-ready-icon"><BrainCircuit size={36} /></div>
                  <h3>{t("proposalWizard", "readyHeading")}</h3>
                  <p className="muted">{t("proposalWizard", "readyBody")}</p>
                  <ul className="proposal-sections-list">
                    {PROPOSAL_SECTION_KEYS.map((key) => (
                      <li key={key}>✓ {t("proposalWizard", key)}</li>
                    ))}
                  </ul>
                  {error && <p className="notice error">{error}</p>}
                  <button className="primary full-button" onClick={generate}>
                    <BrainCircuit size={18} />
                    {t("proposalWizard", "generateFullProposal")}
                  </button>
                </div>
              )}

              {generating && (
                <div className="wizard-streaming">
                  <div className="stream-status">
                    <Loader size={16} className="spinning" />
                    {t("proposalWizard", "generatingStatus")}
                  </div>
                  <textarea
                    className="stream-output"
                    style={{ minHeight: 320, fontSize: 12 }}
                    readOnly
                    value={streamedText}
                  />
                </div>
              )}

              {done && (
                <div className="wizard-done">
                  {bidReadiness !== null && (
                    <div className="bid-readiness-card">
                      <div
                        className="bid-readiness-ring"
                        style={{ "--readiness-color": bidReadinessColor(bidReadiness) } as React.CSSProperties}
                      >
                        <span className="bid-readiness-number">{bidReadiness}</span>
                        <span className="bid-readiness-pct">%</span>
                      </div>
                      <div>
                        <strong style={{ color: bidReadinessColor(bidReadiness), fontSize: 18 }}>
                          {bidReadiness >= 70
                            ? t("proposalWizard", "highBidReadiness")
                            : bidReadiness >= 50
                              ? t("proposalWizard", "moderateBidReadiness")
                              : t("proposalWizard", "lowBidReadiness")}
                        </strong>
                        <p className="muted" style={{ margin: 0 }}>{t("proposalWizard", "bidReadinessCaption")}</p>
                      </div>
                    </div>
                  )}
                  <p className="notice" style={{ marginTop: 12 }}>
                    {t("proposalWizard", "generatedSavedNotice")}
                  </p>
                  <textarea
                    className="stream-output"
                    style={{ minHeight: 280, fontSize: 12 }}
                    readOnly
                    value={streamedText}
                  />
                  <button className="primary full-button" onClick={onClose} style={{ marginTop: 8 }}>
                    {t("proposalWizard", "closeAndView")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div className="wizard-footer">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft size={16} /> {t("proposalWizard", "back")}
            </button>
            <button
              className="primary"
              onClick={() => isLastStep ? generate() : setStep((s) => s + 1)}
            >
              {isLastStep ? t("proposalWizard", "generateProposal") : t("proposalWizard", "next")}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
