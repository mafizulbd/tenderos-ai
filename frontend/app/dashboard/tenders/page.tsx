"use client";

import { useState } from "react";
import { TenderLibrary } from "../../components/TenderLibrary";
import { TenderDetail, TenderDetailEmpty } from "../../components/TenderDetail";
import { useApp } from "../../context/AppContext";
import type { TenderDetail as TDetail } from "../../types";

export default function TendersPage() {
  const {
    token, organization, user, tenders, selectedTender,
    setTenders, setSelectedTender, loadTenders, loadSubscription, selectTender,
  } = useApp();
  const [error, setError] = useState("");

  async function handleSelect(id: number) {
    setError("");
    try {
      await selectTender(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load tender.");
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

  if (!user) return null;

  return (
    <>
      {error && <p className="notice error">{error}</p>}

      <section className="library-layout">
        <TenderLibrary
          tenders={tenders}
          selectedId={selectedTender?.id ?? null}
          token={token}
          onSelect={handleSelect}
          onDeleted={handleDeleted}
        />

        <section className="detail-stack">
          {selectedTender ? (
            <TenderDetail
              key={selectedTender.id}
              tender={selectedTender}
              token={token}
              organization={organization}
              currentUserId={user.id}
              onUpdated={handleTenderUpdated}
              onTendersChanged={loadTenders}
            />
          ) : (
            <TenderDetailEmpty hasTenders={tenders.length > 0} />
          )}
        </section>
      </section>
    </>
  );
}
