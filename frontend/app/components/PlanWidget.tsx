"use client";

import { Zap } from "lucide-react";
import type { Subscription, User } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type Props = {
  user: User;
  subscription: Subscription | null;
};

type PlanKey = keyof (typeof translations)["en"]["plan"];

const PLAN_LABELS: Record<string, { labelKey: PlanKey; color: string }> = {
  free:     { labelKey: "free",     color: "#64748b" },
  pro:      { labelKey: "pro",      color: "#7c3aed" },
  business: { labelKey: "business", color: "#0ea5e9" },
};

export function PlanWidget({ user, subscription }: Props) {
  const { t } = useLanguage();
  const plan = subscription?.plan ?? user.plan ?? "free";
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const used = subscription?.monthly_tenders_used ?? 0;
  const limit = subscription?.monthly_limit ?? 5;
  const isUnlimited = subscription?.is_unlimited ?? false;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = !isUnlimited && used >= limit - 1;

  return (
    <div className="plan-widget">
      <span className="plan-badge" style={{ background: planInfo.color }}>
        {t("plan", planInfo.labelKey)}
      </span>

      <div className="plan-widget-usage">
        {isUnlimited ? (
          <span>{t("plan", "unlimitedAnalyses")}</span>
        ) : (
          <>
            <span className={nearLimit ? "danger" : ""}>{t("plan", "usedThisMonth", { used, limit })}</span>
            <div className="usage-bar-wrap">
              <div className={`usage-bar-fill ${nearLimit ? "danger" : ""}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      {plan === "free" && (
        <a href="mailto:support@tenderos.ai?subject=Upgrade%20to%20Pro" className="upgrade-btn">
          <Zap size={13} />
          {t("plan", "upgrade")}
        </a>
      )}
    </div>
  );
}
