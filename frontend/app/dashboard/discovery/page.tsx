"use client";

import { useRouter } from "next/navigation";
import TenderDiscovery from "../../components/TenderDiscovery";
import { useApp } from "../../context/AppContext";
import type { TenderDetail } from "../../types";

export default function DiscoveryPage() {
  const { token, setSelectedTender, loadTenders } = useApp();
  const router = useRouter();

  return (
    <TenderDiscovery
      token={token}
      onImported={async (tender: TenderDetail) => {
        setSelectedTender(tender);
        await loadTenders();
        router.push("/dashboard/tenders");
      }}
    />
  );
}
