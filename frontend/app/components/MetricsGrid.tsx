"use client";

import { CheckCircle2, FileText, Target, Trophy, TrendingUp } from "lucide-react";
import type { TenderSummary } from "../types";
import { useLanguage } from "../i18n/LanguageContext";

type Props = { tenders: TenderSummary[] };

export function MetricsGrid({ tenders }: Props) {
  const { t } = useLanguage();
  const total     = tenders.length;
  const won       = tenders.filter((t) => t.bid_status === "won").length;
  const lost      = tenders.filter((t) => t.bid_status === "lost").length;
  const submitted = tenders.filter((t) => t.bid_status === "submitted").length;
  const withDeadline = tenders.filter(
    (t) => t.deadline && new Date(t.deadline) > new Date(),
  ).length;
  const decided  = won + lost;
  const winRate  = decided > 0 ? Math.round((won / decided) * 100) : null;
  const avgScore = (() => {
    const scored = tenders.filter(t => t.bid_score !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((s, t) => s + (t.bid_score ?? 0), 0) / scored.length);
  })();

  return (
    <section id="overview" className="metric-grid">
      <article className="metric-card">
        <div className="metric-icon blue"><FileText size={22} /></div>
        <span>{t("metrics", "totalTenders")}</span>
        <strong>{total}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon amber"><Target size={22} /></div>
        <span>{t("metrics", "submitted")}</span>
        <strong>{submitted}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon green"><Trophy size={22} /></div>
        <span>{t("metrics", "won")}</span>
        <strong>{won}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon blue"><CheckCircle2 size={22} /></div>
        <span>{t("metrics", "activeDeadlines")}</span>
        <strong>{withDeadline}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon green"><TrendingUp size={22} /></div>
        <span>{t("metrics", "winRate")}</span>
        <strong>{winRate !== null ? `${winRate}%` : "—"}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon blue"><Target size={22} /></div>
        <span>{t("metrics", "avgBidScore")}</span>
        <strong>{avgScore !== null ? `${avgScore}/100` : "—"}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon amber"><FileText size={22} /></div>
        <span>{t("metrics", "underReview")}</span>
        <strong>{tenders.filter(x => x.bid_status === "reviewing").length}</strong>
      </article>

      <article className="metric-card">
        <div className="metric-icon red"><Target size={22} /></div>
        <span>{t("metrics", "lostNoBid")}</span>
        <strong>{lost + tenders.filter(x => x.bid_status === "no-bid").length}</strong>
      </article>
    </section>
  );
}
