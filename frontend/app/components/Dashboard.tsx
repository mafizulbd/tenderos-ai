"use client";

import { RefreshCw } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MetricsGrid } from "./MetricsGrid";
import { UploadPanel } from "./UploadPanel";
import { ProfilePanel } from "./ProfilePanel";
import { TeamPanel } from "./TeamPanel";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";
import { TenderCalendar } from "./TenderCalendar";
import { TenderLibrary } from "./TenderLibrary";
import { TenderDetail, TenderDetailEmpty } from "./TenderDetail";
import ReminderPanel from "./ReminderPanel";
import TenderDiscovery from "./TenderDiscovery";
import DocumentValidator from "./DocumentValidator";
import type { Organization, Subscription, TenderDetail as TDetail, TenderSummary, User } from "../types";
import { apiRequest } from "../api";
import { useState } from "react";

type Props = {
  user: User;
  token: string;
  organization: Organization | null;
  subscription: Subscription | null;
  tenders: TenderSummary[];
  selectedTender: TDetail | null;
  setUser: (u: User) => void;
  setOrganization: (o: Organization) => void;
  setSubscription: (s: Subscription) => void;
  setTenders: (ts: TenderSummary[]) => void;
  setSelectedTender: (t: TDetail | null) => void;
  loadTenders: () => Promise<void>;
  loadSubscription: () => Promise<void>;
  logout: () => void;
};

export function Dashboard({
  user,
  token,
  organization,
  subscription,
  tenders,
  selectedTender,
  setUser,
  setOrganization,
  setSubscription,
  setTenders,
  setSelectedTender,
  loadTenders,
  loadSubscription,
  logout,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState("");

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadTenders(), loadSubscription()]);
    setRefreshing(false);
  }

  async function loadTender(id: number) {
    setGlobalError("");
    try {
      const data = await apiRequest<TDetail>(`/tenders/${id}`, {}, token);
      setSelectedTender(data);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Could not load tender.");
    }
  }

  function handleDeleted(id: number) {
    setTenders(tenders.filter((t) => t.id !== id));
    if (selectedTender?.id === id) setSelectedTender(null);
  }

  async function handleTenderUpdated(updated: TDetail) {
    setSelectedTender(updated);
    await Promise.all([loadTenders(), loadSubscription()]);
  }

  return (
    <main className="dashboard">
      <Sidebar user={user} subscription={subscription} onLogout={logout} />

      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>{user.organization_name || "Tender Workspace"}</h1>
            <p className="muted">
              Upload tenders, track bids, and export submission-ready reports for Bangladesh procurement.
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? "spinning" : ""} />
            Refresh
          </button>
        </header>

        {globalError && <p className="notice error">{globalError}</p>}

        <MetricsGrid tenders={tenders} />

        <section className="content-grid">
          <UploadPanel
            token={token}
            subscription={subscription}
            onComplete={(tender) => setSelectedTender(tender)}
            onTendersChanged={async () => {
              await Promise.all([loadTenders(), loadSubscription()]);
            }}
          />
          <ProfilePanel user={user} token={token} onUpdate={setUser} />
        </section>

        <TeamPanel token={token} organization={organization} onOrganizationUpdated={setOrganization} />

        <ReminderPanel token={token} onSelectTender={loadTender} />

        <KnowledgeBasePanel token={token} />

        <TenderCalendar tenders={tenders} onSelect={loadTender} />

        <TenderDiscovery
          token={token}
          onImported={async (tender) => {
            setSelectedTender(tender);
            await loadTenders();
          }}
        />

        <div id="doc-validator">
          <DocumentValidator token={token} />
        </div>

        <section className="library-layout">
          <TenderLibrary
            tenders={tenders}
            selectedId={selectedTender?.id ?? null}
            token={token}
            onSelect={loadTender}
            onDeleted={handleDeleted}
          />

          <section className="detail-stack">
            {selectedTender ? (
              <TenderDetail
                tender={selectedTender}
                token={token}
                onUpdated={handleTenderUpdated}
                onTendersChanged={loadTenders}
              />
            ) : (
              <TenderDetailEmpty />
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
