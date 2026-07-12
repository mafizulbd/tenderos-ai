"use client";

import { Zap } from "lucide-react";
import type { Subscription, User } from "../types";

type Props = {
  user: User;
  subscription: Subscription | null;
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: "Free",     color: "#64748b" },
  pro:      { label: "Pro",      color: "#7c3aed" },
  business: { label: "Business", color: "#0ea5e9" },
};

export function PlanWidget({ user, subscription }: Props) {
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
        {planInfo.label}
      </span>

      <div className="plan-widget-usage">
        {isUnlimited ? (
          <span>Unlimited analyses</span>
        ) : (
          <>
            <span className={nearLimit ? "danger" : ""}>{used} / {limit} this month</span>
            <div className="usage-bar-wrap">
              <div className={`usage-bar-fill ${nearLimit ? "danger" : ""}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      {plan === "free" && (
        <a href="mailto:support@tenderos.ai?subject=Upgrade%20to%20Pro" className="upgrade-btn">
          <Zap size={13} />
          Upgrade
        </a>
      )}
    </div>
  );
}
