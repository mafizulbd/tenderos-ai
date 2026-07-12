"use client";

import { useRouter } from "next/navigation";
import { MetricsGrid } from "../components/MetricsGrid";
import { UploadPanel } from "../components/UploadPanel";
import NotificationsPanel from "../components/NotificationsPanel";
import { useApp } from "../context/AppContext";

export default function OverviewPage() {
  const { token, tenders, subscription, setSelectedTender, loadTenders, loadSubscription, selectTender } = useApp();
  const router = useRouter();

  async function handleSelectEntity(entityType: string | null, entityId: number | null) {
    if (!entityId) return;
    if (entityType === "tender") {
      await selectTender(entityId);
      router.push("/dashboard/tenders");
    } else if (entityType === "vendor") {
      router.push("/dashboard/vendors");
    } else if (entityType === "contract") {
      router.push("/dashboard/contracts");
    }
  }

  return (
    <>
      <MetricsGrid tenders={tenders} />

      <UploadPanel
        token={token}
        subscription={subscription}
        onComplete={(tender) => setSelectedTender(tender)}
        onTendersChanged={async () => {
          await Promise.all([loadTenders(), loadSubscription()]);
          router.push("/dashboard/tenders");
        }}
      />

      <NotificationsPanel token={token} onSelectEntity={handleSelectEntity} />
    </>
  );
}
