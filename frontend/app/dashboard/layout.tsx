"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { PlanWidget } from "../components/PlanWidget";
import { useApp } from "../context/AppContext";
import { apiRequest } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, organization, subscription, loadTenders, loadSubscription, logout } = useApp();
  const { t } = useLanguage();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!token || !user) router.replace("/");
  }, [token, user, router]);

  if (!token || !user) return null;

  async function resendVerification() {
    setResendState("sending");
    try {
      await apiRequest("/auth/resend-verification", { method: "POST" }, token);
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadTenders(), loadSubscription()]);
    setRefreshing(false);
  }

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <main className="dashboard">
      <Sidebar user={user} onLogout={handleLogout} />

      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("dashboard", "topbarLabel")}</p>
            <h1>{organization?.name || t("dashboard", "defaultWorkspaceName")}</h1>
            <p className="muted">{t("dashboard", "subtitle")}</p>
          </div>
          <div className="topbar-actions">
            <PlanWidget user={user} subscription={subscription} />
            <button onClick={refresh} disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? "spinning" : ""} />
              {t("common", "refresh")}
            </button>
          </div>
        </header>

        {!user.email_verified && !bannerDismissed && (
          <div className="notice warn verify-banner">
            <Mail size={16} />
            <span>
              {t("common", "verifyEmailNotice")}
              {resendState === "sent" ? ` ${t("common", "verificationSentNotice")}` : ""}
            </span>
            <div className="verify-banner-actions">
              {resendState !== "sent" && (
                <button onClick={resendVerification} disabled={resendState === "sending"}>
                  {resendState === "sending" ? t("common", "sending") : t("common", "resendEmail")}
                </button>
              )}
              <button className="link-button" onClick={() => setBannerDismissed(true)}>
                {t("common", "dismiss")}
              </button>
            </div>
          </div>
        )}

        {children}
      </section>
    </main>
  );
}
