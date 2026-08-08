"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { apiRequest } from "../api";
import type { CalendarEvent, Urgency } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type Props = {
  token: string;
  onSelectEvent: (event: CalendarEvent) => void;
};

type CalendarKey = keyof (typeof translations)["en"]["calendarPage"];

const MONTH_KEYS: CalendarKey[] = [
  "month0", "month1", "month2", "month3", "month4", "month5",
  "month6", "month7", "month8", "month9", "month10", "month11",
];
const DAY_KEYS: CalendarKey[] = ["day0", "day1", "day2", "day3", "day4", "day5", "day6"];

const URGENCY_COLOR: Record<Urgency, string> = {
  critical: "#dc2626",
  warning: "#d97706",
  info: "#1f6fc9",
};

const TYPE_LABEL_KEY: Record<CalendarEvent["type"], CalendarKey> = {
  tender_deadline: "typeTenderDeadline",
  contract_end: "typeContractEnd",
  task_due: "typeTaskDue",
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function UnifiedCalendar({ token, onSelectEvent }: Props) {
  const { t } = useLanguage();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: CalendarEvent[] } | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load() {
    try {
      const data = await apiRequest<{ events: CalendarEvent[] }>("/calendar", {}, token);
      setEvents(data.events);
    } catch {
      // non-critical
    }
  }

  const eventMap = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push(e);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function handleDayClick(day: number, e: React.MouseEvent) {
    const key = `${year}-${month}-${day}`;
    const items = eventMap.get(key);
    if (!items) return;
    if (items.length === 1) { onSelectEvent(items[0]); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left, y: rect.bottom + 6, items });
  }

  const upcoming = events
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  return (
    <section className="surface calendar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("calendarPage", "eyebrow")}</p>
          <h2>{t("calendarPage", "heading")}</h2>
        </div>
        <Calendar size={20} />
      </div>

      <div className="cal-layout">
        <div className="cal-grid-wrap">
          <div className="cal-nav">
            <button className="icon-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <strong>{t("calendarPage", MONTH_KEYS[month])} {year}</strong>
            <button className="icon-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          <div className="cal-grid">
            {DAY_KEYS.map((dKey) => (
              <div key={dKey} className="cal-day-name">{t("calendarPage", dKey)}</div>
            ))}

            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell empty" />;
              const key = `${year}-${month}-${day}`;
              const items = eventMap.get(key) || [];
              const today = sameDay(new Date(year, month, day), now);
              const past = new Date(year, month, day) < now && !today;
              return (
                <div
                  key={i}
                  className={`cal-cell ${today ? "today" : ""} ${past ? "past" : ""} ${items.length > 0 ? "has-deadline" : ""}`}
                  onClick={(e) => items.length > 0 && handleDayClick(day, e)}
                  title={items.map((e) => e.title).join(", ")}
                >
                  <span className="cal-num">{day}</span>
                  {items.length > 0 && (
                    <div className="cal-dots">
                      {items.slice(0, 3).map((e, di) => (
                        <span key={di} className="cal-dot" style={{ background: URGENCY_COLOR[e.urgency] }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cal-legend">
            <span><span className="cal-dot" style={{ background: URGENCY_COLOR.critical, display: "inline-block" }} /> {t("calendarPage", "legendCritical")}</span>
            <span><span className="cal-dot" style={{ background: URGENCY_COLOR.warning, display: "inline-block" }} /> {t("calendarPage", "legendWarning")}</span>
            <span><span className="cal-dot" style={{ background: URGENCY_COLOR.info, display: "inline-block" }} /> {t("calendarPage", "legendInfo")}</span>
          </div>
        </div>

        <div className="cal-upcoming">
          <h3 style={{ marginBottom: 10, fontSize: 14 }}>{t("calendarPage", "upcomingHeading")}</h3>
          {upcoming.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>{t("calendarPage", "nothingYet")}</p>
          )}
          {upcoming.map((e, i) => {
            const d = new Date(e.date);
            const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <button key={i} className="upcoming-row" onClick={() => onSelectEvent(e)}>
                <div className={`upcoming-days ${e.urgency === "critical" ? "urgent" : ""}`}>
                  <strong>{daysLeft}</strong>
                  <span>{t("calendarPage", daysLeft !== 1 ? "dayPlural" : "daySingular")}</span>
                </div>
                <div className="upcoming-info">
                  <strong className="upcoming-title">{e.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {t("calendarPage", TYPE_LABEL_KEY[e.type])} · {d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {tooltip && (
        <div
          className="cal-tooltip"
          style={{ position: "fixed", top: tooltip.y, left: tooltip.x, zIndex: 200 }}
          onMouseLeave={() => setTooltip(null)}
        >
          {tooltip.items.map((e, i) => (
            <button key={i} className="cal-tooltip-item" onClick={() => { onSelectEvent(e); setTooltip(null); }}>
              {e.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
