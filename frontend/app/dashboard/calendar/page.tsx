"use client";

import { useRouter } from "next/navigation";
import { TenderCalendar } from "../../components/TenderCalendar";
import { useApp } from "../../context/AppContext";

export default function CalendarPage() {
  const { tenders, selectTender } = useApp();
  const router = useRouter();

  return (
    <TenderCalendar
      tenders={tenders}
      onSelect={async (id) => {
        await selectTender(id);
        router.push("/dashboard/tenders");
      }}
    />
  );
}
