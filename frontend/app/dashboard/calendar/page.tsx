"use client";

import { useRouter } from "next/navigation";
import { UnifiedCalendar } from "../../components/UnifiedCalendar";
import { useApp } from "../../context/AppContext";
import type { CalendarEvent } from "../../types";

export default function CalendarPage() {
  const { token, selectTender } = useApp();
  const router = useRouter();

  async function handleSelectEvent(event: CalendarEvent) {
    if (event.entity_type === "tender" && event.entity_id) {
      await selectTender(event.entity_id);
      router.push("/dashboard/tenders");
    } else if (event.entity_type === "contract") {
      router.push("/dashboard/contracts");
    } else if (event.entity_type === "vendor") {
      router.push("/dashboard/vendors");
    }
  }

  return <UnifiedCalendar token={token} onSelectEvent={handleSelectEvent} />;
}
