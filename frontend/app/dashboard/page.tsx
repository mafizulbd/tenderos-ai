"use client";

import { useRouter } from "next/navigation";
import { MetricsGrid } from "../components/MetricsGrid";
import { UploadPanel } from "../components/UploadPanel";
import ReminderPanel from "../components/ReminderPanel";
import { useApp } from "../context/AppContext";

export default function OverviewPage() {
  const { token, tenders, subscription, setSelectedTender, loadTenders, loadSubscription, selectTender } = useApp();
  const router = useRouter();

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

      <ReminderPanel
        token={token}
        onSelectTender={async (id) => {
          await selectTender(id);
          router.push("/dashboard/tenders");
        }}
      />
    </>
  );
}
