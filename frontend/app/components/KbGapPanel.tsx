"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Loader, RefreshCw, Sparkles } from "lucide-react";
import { apiRequest } from "../api";
import type { KbGapCategory, KbGapQuestion, TenderDetail as TDetail } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type KbGapsKey = keyof (typeof translations)["en"]["kbGaps"];

const CATEGORY_LABEL_KEY: Record<KbGapCategory, KbGapsKey> = {
  certifications: "categoryCertifications",
  personnel: "categoryPersonnel",
  projects: "categoryProjects",
  basics: "categoryBasics",
  equipment: "categoryEquipment",
  other: "categoryOther",
};

type Props = {
  tender: TDetail;
  token: string;
  onSaved: (questions: KbGapQuestion[]) => void;
};

export function KbGapPanel({ tender, token, onSaved }: Props) {
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const questions = tender.kb_gap_questions;

  async function check() {
    setChecking(true);
    setError("");
    try {
      const form = new FormData();
      form.append("language", tender.language || "english");
      const result = await apiRequest<{ kb_gap_questions: KbGapQuestion[] }>(
        `/tenders/${tender.id}/kb-gaps`,
        { method: "POST", body: form },
        token,
      );
      onSaved(result.kb_gap_questions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("kbGaps", "checkFailed"));
    } finally {
      setChecking(false);
    }
  }

  const grouped: Partial<Record<KbGapCategory, KbGapQuestion[]>> = {};
  for (const q of questions ?? []) {
    (grouped[q.category] ||= []).push(q);
  }

  if (checking) {
    return (
      <section className="surface strategy-generating">
        <div className="stream-status">
          <Loader size={16} className="spinning" />
          {t("kbGaps", "checkingStatus")}
        </div>
      </section>
    );
  }

  if (questions === null) {
    return (
      <section className="surface strategy-empty">
        <div className="strategy-empty-icon"><Sparkles size={28} /></div>
        <div>
          <h3>{t("kbGaps", "heading")}</h3>
          <p className="muted">{t("kbGaps", "body")}</p>
          <button className="primary" onClick={check} style={{ marginTop: 12 }}>
            <Sparkles size={16} /> {t("kbGaps", "checkButton")}
          </button>
          {error && <p className="notice error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="surface kb-gap-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("kbGaps", "heading")}</p>
          <h2>{t("kbGaps", "heading")}</h2>
        </div>
        <button onClick={check}>
          <RefreshCw size={15} /> {t("kbGaps", "recheckButton")}
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}

      {questions.length === 0 ? (
        <p className="notice" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> {t("kbGaps", "noGapsFound")}
        </p>
      ) : (
        <>
          {(Object.keys(grouped) as KbGapCategory[]).map((category) => (
            <div key={category} style={{ marginBottom: 14 }}>
              <strong style={{ fontSize: 13 }}>{t("kbGaps", CATEGORY_LABEL_KEY[category])}</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {grouped[category]!.map((q, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{q.question}</li>
                ))}
              </ul>
            </div>
          ))}
          <Link
            href="/dashboard/knowledge-base"
            className="link-button"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <BookOpen size={14} /> {t("kbGaps", "goToKnowledgeBase")}
          </Link>
        </>
      )}
    </section>
  );
}
