"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { TenderSummary } from "../types";

type Props = {
  tenders: TenderSummary[];
  onSelect: (id: number) => void;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function scoreColor(score: number | null): string {
  if (!score) return "#1f6fc9";
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function TenderCalendar({ tenders, onSelect }: Props) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: TenderSummary[] } | null>(null);

  // Build deadline map
  const deadlineMap = new Map<string, TenderSummary[]>();
  for (const t of tenders) {
    if (!t.deadline) continue;
    const d = new Date(t.deadline);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!deadlineMap.has(key)) deadlineMap.set(key, []);
    deadlineMap.get(key)!.push(t);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to 6 rows
  while (cells.length % 7 !== 0) cells.push(null);

  function handleDayClick(day: number, e: React.MouseEvent) {
    const key = `${year}-${month}-${day}`;
    const items = deadlineMap.get(key);
    if (!items) return;
    if (items.length === 1) { onSelect(items[0].id); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left, y: rect.bottom + 6, items });
  }

  const upcomingWithDeadline = tenders
    .filter(t => t.deadline && new Date(t.deadline) >= now)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  return (
    <section className="surface calendar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Tender calendar</p>
          <h2>Deadline Tracker</h2>
        </div>
        <Calendar size={20} />
      </div>

      <div className="cal-layout">
        {/* Calendar grid */}
        <div className="cal-grid-wrap">
          <div className="cal-nav">
            <button className="icon-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <strong>{MONTHS[month]} {year}</strong>
            <button className="icon-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          <div className="cal-grid">
            {DAYS.map(d => (
              <div key={d} className="cal-day-name">{d}</div>
            ))}

            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell empty" />;
              const key = `${year}-${month}-${day}`;
              const items = deadlineMap.get(key) || [];
              const today = sameDay(new Date(year, month, day), now);
              const past  = new Date(year, month, day) < now && !today;
              return (
                <div
                  key={i}
                  className={`cal-cell ${today ? "today" : ""} ${past ? "past" : ""} ${items.length > 0 ? "has-deadline" : ""}`}
                  onClick={(e) => items.length > 0 && handleDayClick(day, e)}
                  title={items.map(t => t.title).join(", ")}
                >
                  <span className="cal-num">{day}</span>
                  {items.length > 0 && (
                    <div className="cal-dots">
                      {items.slice(0, 3).map((t, di) => (
                        <span
                          key={di}
                          className="cal-dot"
                          style={{ background: scoreColor(t.bid_score) }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cal-legend">
            <span><span className="cal-dot" style={{ background: "#16a34a", display: "inline-block" }} /> High score</span>
            <span><span className="cal-dot" style={{ background: "#d97706", display: "inline-block" }} /> Mid score</span>
            <span><span className="cal-dot" style={{ background: "#dc2626", display: "inline-block" }} /> Low / no score</span>
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="cal-upcoming">
          <h3 style={{ marginBottom: 10, fontSize: 14 }}>Upcoming Deadlines</h3>
          {upcomingWithDeadline.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>No upcoming deadlines set.</p>
          )}
          {upcomingWithDeadline.map(t => {
            const d = new Date(t.deadline!);
            const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const urgent = daysLeft <= 3;
            return (
              <button
                key={t.id}
                className="upcoming-row"
                onClick={() => onSelect(t.id)}
              >
                <div className={`upcoming-days ${urgent ? "urgent" : ""}`}>
                  <strong>{daysLeft}</strong>
                  <span>day{daysLeft !== 1 ? "s" : ""}</span>
                </div>
                <div className="upcoming-info">
                  <strong className="upcoming-title">{t.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {t.bid_score !== null && (
                  <span className="upcoming-score" style={{ color: scoreColor(t.bid_score) }}>
                    {t.bid_score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tooltip for multi-tender day */}
      {tooltip && (
        <div
          className="cal-tooltip"
          style={{ position: "fixed", top: tooltip.y, left: tooltip.x, zIndex: 200 }}
          onMouseLeave={() => setTooltip(null)}
        >
          {tooltip.items.map(t => (
            <button key={t.id} className="cal-tooltip-item" onClick={() => { onSelect(t.id); setTooltip(null); }}>
              {t.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
