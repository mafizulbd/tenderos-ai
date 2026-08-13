"use client";

import { Check, FileSignature, FileSearch, Eye, Scale, Send, Sparkles, UploadCloud } from "lucide-react";
import type { TenderDetail as TDetail } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type StepKey = "upload" | "understand" | "match" | "decide" | "draft" | "review" | "submit";
type StepperKey = keyof (typeof translations)["en"]["stepper"];

const STEPS: { key: StepKey; labelKey: StepperKey; anchor: string; icon: React.ReactNode }[] = [
  { key: "upload",     labelKey: "upload",     anchor: "tender-header",     icon: <UploadCloud size={15} /> },
  { key: "understand", labelKey: "understand", anchor: "tender-understand", icon: <FileSearch size={15} /> },
  { key: "match",      labelKey: "match",      anchor: "tender-match",      icon: <Sparkles size={15} /> },
  { key: "decide",     labelKey: "decide",     anchor: "tender-decide",     icon: <Scale size={15} /> },
  { key: "draft",      labelKey: "draft",      anchor: "tender-draft",      icon: <FileSignature size={15} /> },
  { key: "review",     labelKey: "review",     anchor: "tender-review",     icon: <Eye size={15} /> },
  { key: "submit",     labelKey: "submit",     anchor: "tender-review",     icon: <Send size={15} /> },
];

/** Every flag here is derived from data already on the tender — no new
 * backend state. "Current" is the first step not yet done; everything
 * before it is done, everything after is upcoming. */
function computeDone(tender: TDetail): Record<StepKey, boolean> {
  return {
    upload: true,
    understand: tender.status === "completed",
    match: tender.kb_gap_questions !== null,
    decide: !!tender.bid_strategy,
    draft: !!tender.personalized_proposal,
    review: tender.bid_status !== "reviewing",
    submit: ["submitted", "won", "lost"].includes(tender.bid_status),
  };
}

function scrollToAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenderStepper({ tender }: { tender: TDetail }) {
  const { t } = useLanguage();
  const done = computeDone(tender);
  const currentIndex = STEPS.findIndex((s) => !done[s.key]);

  return (
    <nav className="tender-stepper" aria-label="Tender workflow progress">
      {STEPS.map((step, i) => {
        const isDone = done[step.key];
        const isCurrent = i === currentIndex;
        const state = isDone ? "done" : isCurrent ? "current" : "upcoming";
        return (
          <button
            key={step.key}
            type="button"
            className={`stepper-item stepper-${state}`}
            onClick={() => scrollToAnchor(step.anchor)}
          >
            <span className="stepper-icon">{isDone ? <Check size={15} /> : step.icon}</span>
            <span className="stepper-label">{t("stepper", step.labelKey)}</span>
            {i < STEPS.length - 1 && <span className="stepper-connector" />}
          </button>
        );
      })}
    </nav>
  );
}
