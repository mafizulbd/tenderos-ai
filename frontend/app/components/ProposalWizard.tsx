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

type Step = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  { title: "Language & Bid Price",  description: "Choose language and set your proposed bid amount.",       icon: <FileText size={20} /> },
  { title: "Timeline & Terms",      description: "Completion timeline, warranty, and payment preferences.",  icon: <ChevronRight size={20} /> },
  { title: "Project Manager",       description: "Key personnel and technical methodology overview.",        icon: <Users size={20} /> },
  { title: "Generate Proposal",     description: "AI will generate your full submission-ready proposal.",    icon: <BrainCircuit size={20} /> },
];

function extractWinProbability(text: string): number | null {
  const m = text.match(/WIN PROBABILITY:\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function winProbColor(prob: number): string {
  if (prob >= 70) return "#16a34a";
  if (prob >= 50) return "#d97706";
  return "#dc2626";
}

export function ProposalWizard({ tender, token, onComplete, onClose }: Props) {
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
        throw new Error(err?.detail ?? "Generation failed.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream.");

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
      setError(err instanceof Error ? err.message : "Proposal generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  const winProb = done ? extractWinProbability(streamedText) : null;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="wizard-overlay" onClick={(e) => e.target === e.currentTarget && !generating && onClose()}>
      <div className="wizard-modal">
        {/* Header */}
        <div className="wizard-header">
          <div>
            <p className="eyebrow">AI Proposal Generator</p>
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
              <span className="step-label">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="wizard-body">
          {step === 0 && (
            <div className="wizard-section">
              <h3>Language & Bid Price</h3>
              <p className="muted">These settings guide AI language and financial references in the proposal.</p>
              <div className="field-row">
                <label>
                  Proposal Language
                  <select value={data.language} onChange={(e) => setField("language", e.target.value)}>
                    <option value="english">English</option>
                    <option value="bangla">বাংলা (Bangla)</option>
                  </select>
                </label>
                <label>
                  Proposed Bid Price (BDT)
                  <input
                    value={data.bid_price}
                    onChange={(e) => setField("bid_price", e.target.value)}
                    placeholder="e.g. 2,50,00,000"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-section">
              <h3>Timeline & Commercial Terms</h3>
              <p className="muted">AI will include these in the Implementation Plan and Financial Proposal sections.</p>
              <div className="field-row">
                <label>
                  Proposed Completion Time
                  <input
                    value={data.timeline}
                    onChange={(e) => setField("timeline", e.target.value)}
                    placeholder="e.g. 18 months"
                  />
                </label>
                <label>
                  Warranty / Defect Liability Period
                  <input
                    value={data.warranty}
                    onChange={(e) => setField("warranty", e.target.value)}
                    placeholder="e.g. 12 months"
                  />
                </label>
              </div>
              <label>
                Payment Terms Preference
                <input
                  value={data.payment_terms}
                  onChange={(e) => setField("payment_terms", e.target.value)}
                  placeholder="e.g. Monthly progress payment, milestone-based..."
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-section">
              <h3>Key Personnel & Methodology</h3>
              <p className="muted">Additional context to personalize the team and technical approach sections.</p>
              <label>
                Project Manager for this Tender
                <input
                  value={data.project_manager}
                  onChange={(e) => setField("project_manager", e.target.value)}
                  placeholder="Name and designation, e.g. Engr. Rahman Hossain (Senior PM)"
                />
              </label>
              <label style={{ marginTop: 12 }}>
                Technical Approach Notes (optional)
                <textarea
                  value={data.methodology}
                  onChange={(e) => setField("methodology", e.target.value)}
                  rows={4}
                  placeholder="Any special methodology, unique approach, local partnerships, or key differentiators you want highlighted..."
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-section">
              {!generating && !done && (
                <div className="wizard-generate-ready">
                  <div className="wizard-ready-icon"><BrainCircuit size={36} /></div>
                  <h3>Ready to Generate</h3>
                  <p className="muted">
                    AI will create a complete, submission-ready proposal using your company knowledge base
                    and the tender analysis. This typically takes 30–60 seconds.
                  </p>
                  <ul className="proposal-sections-list">
                    {["Cover Letter", "Company Introduction", "Understanding of Requirements", "Technical Approach & Methodology",
                      "Implementation Plan", "Project Team Structure", "Equipment Plan", "Past Similar Projects",
                      "Financial Proposal", "Quality Assurance", "Compliance Declaration", "Win Probability Assessment"].map((s) => (
                      <li key={s}>✓ {s}</li>
                    ))}
                  </ul>
                  {error && <p className="notice error">{error}</p>}
                  <button className="primary full-button" onClick={generate}>
                    <BrainCircuit size={18} />
                    Generate Full Proposal
                  </button>
                </div>
              )}

              {generating && (
                <div className="wizard-streaming">
                  <div className="stream-status">
                    <Loader size={16} className="spinning" />
                    Generating your proposal... please wait
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
                  {winProb !== null && (
                    <div className="win-prob-card">
                      <div
                        className="win-prob-ring"
                        style={{ "--prob-color": winProbColor(winProb) } as React.CSSProperties}
                      >
                        <span className="win-prob-number">{winProb}</span>
                        <span className="win-prob-pct">%</span>
                      </div>
                      <div>
                        <strong style={{ color: winProbColor(winProb), fontSize: 18 }}>
                          {winProb >= 70 ? "High Win Probability" : winProb >= 50 ? "Moderate Win Probability" : "Low Win Probability"}
                        </strong>
                        <p className="muted" style={{ margin: 0 }}>AI-assessed win probability for this bid</p>
                      </div>
                    </div>
                  )}
                  <p className="notice" style={{ marginTop: 12 }}>
                    Proposal generated and saved. Scroll down in the tender detail to read it in full.
                  </p>
                  <textarea
                    className="stream-output"
                    style={{ minHeight: 280, fontSize: 12 }}
                    readOnly
                    value={streamedText}
                  />
                  <button className="primary full-button" onClick={onClose} style={{ marginTop: 8 }}>
                    Close &amp; View Proposal
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
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className="primary"
              onClick={() => isLastStep ? generate() : setStep((s) => s + 1)}
            >
              {isLastStep ? "Generate Proposal" : "Next"}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
