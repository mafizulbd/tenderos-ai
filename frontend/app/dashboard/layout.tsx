"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { PlanWidget } from "../components/PlanWidget";
import { useApp } from "../context/AppContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, organization, subscription, loadTenders, loadSubscription, logout } = useApp();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!token || !user) router.replace("/");
  }, [token, user, router]);

  if (!token || !user) return null;

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

        {children}
      </section>
    </main>
  );
}
