"use client";

import { BarChart3, Bell, BookOpen, BrainCircuit, Building2, FileSearch, FolderKanban, Globe, LogOut, ShieldCheck, UploadCloud, Users, Zap } from "lucide-react";
import type { Subscription, User } from "../types";

type Props = {
  user: User;
  subscription: Subscription | null;
  onLogout: () => void;
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: "Free",     color: "#64748b" },
  pro:      { label: "Pro",      color: "#7c3aed" },
  business: { label: "Business", color: "#0ea5e9" },
};

export function Sidebar({ user, subscription, onLogout }: Props) {
  const plan = subscription?.plan ?? user.plan ?? "free";
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const used = subscription?.monthly_tenders_used ?? 0;
  const limit = subscription?.monthly_limit ?? 5;
  const isUnlimited = subscription?.is_unlimited ?? false;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = !isUnlimited && used >= limit - 1;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <FileSearch size={24} />
        </div>
        <div>
          <strong>TenderOS AI</strong>
          <span>Bangladesh Procurement</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Dashboard sections">
        <a href="#overview">
          <BarChart3 size={18} />
          Overview
        </a>
        <a href="#analyze">
          <UploadCloud size={18} />
          Analyze
        </a>
        <a href="#history">
          <FolderKanban size={18} />
          Tender library
        </a>
        <a href="#profile">
          <Building2 size={18} />
          Company profile
        </a>
        <a href="#team">
          <Users size={18} />
          Team
        </a>
        <a href="#knowledgebase">
          <BookOpen size={18} />
          Knowledge base
        </a>
        <a href="#discovery">
          <Globe size={18} />
          Discovery
        </a>
        <a href="#doc-validator">
          <ShieldCheck size={18} />
          Doc Validator
        </a>
      </nav>

      <div className="ai-proposal-hint">
        <BrainCircuit size={16} />
        <span>Click any tender → <strong>AI Proposal</strong> to generate a full bid</span>
      </div>

      <div className="plan-panel">
        <div className="plan-header">
          <span className="plan-badge" style={{ background: planInfo.color }}>
            {planInfo.label}
          </span>
          <span className="plan-email">{user.email}</span>
        </div>

        {!isUnlimited && (
          <>
            <div className="usage-bar-wrap">
              <div
                className={`usage-bar-fill ${nearLimit ? "danger" : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className={`usage-text ${nearLimit ? "danger" : ""}`}>
              {used} / {limit} analyses this month
            </p>
          </>
        )}
        {isUnlimited && (
          <p className="usage-text">Unlimited analyses</p>
        )}

        {plan === "free" && (
          <div className="upgrade-box">
            <p>
              <Zap size={13} /> Upgrade to <strong>Pro — ৳999/month</strong>
              <br />
              Unlimited analyses · Priority support
            </p>
            <a
              href="mailto:support@tenderos.ai?subject=Upgrade%20to%20Pro"
              className="upgrade-btn"
            >
              Upgrade now
            </a>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button onClick={onLogout} title="Logout">
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
