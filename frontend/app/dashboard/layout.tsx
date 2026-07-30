"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { PlanWidget } from "../components/PlanWidget";
import { useApp } from "../context/AppContext";
import { apiRequest } from "../api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, organization, subscription, loadTenders, loadSubscription, logout } = useApp();
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
            <p className="eyebrow">Dashboard</p>
            <h1>{organization?.name || "Tender Workspace"}</h1>
            <p className="muted">
              Upload tenders, track bids, and export submission-ready reports for Bangladesh procurement.
            </p>
          </div>
          <div className="topbar-actions">
            <PlanWidget user={user} subscription={subscription} />
            <button onClick={refresh} disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? "spinning" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {!user.email_verified && !bannerDismissed && (
          <div className="notice warn verify-banner">
            <Mail size={16} />
            <span>
              Verify your email to secure your account.
              {resendState === "sent"
                ? " Verification email sent — check your inbox."
                : ""}
            </span>
            <div className="verify-banner-actions">
              {resendState !== "sent" && (
                <button onClick={resendVerification} disabled={resendState === "sending"}>
                  {resendState === "sending" ? "Sending..." : "Resend email"}
                </button>
              )}
              <button className="link-button" onClick={() => setBannerDismissed(true)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {children}
      </section>
    </main>
  );
}
