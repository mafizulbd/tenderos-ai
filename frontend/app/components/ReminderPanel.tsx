"use client";
import { useEffect, useState } from "react";
import { Bell, AlertTriangle, Clock, TrendingUp, Shield, RefreshCw } from "lucide-react";

interface Reminder {
  type: "deadline" | "high_score" | "cert_expiry";
  tender_id: number | null;
  title: string;
  deadline: string | null;
  days_left: number | null;
  bid_status: string | null;
  bid_score: number | null;
  urgency: "critical" | "warning" | "info";
  message: string;
}

const TYPE_ICONS = {
  deadline: Clock,
  high_score: TrendingUp,
  cert_expiry: Shield,
};

const URGENCY_CLASSES = {
  critical: "rem-critical",
  warning: "rem-warning",
  info: "rem-info",
};

export default function ReminderPanel({
  token,
  onSelectTender,
}: {
  token: string;
  onSelectTender?: (id: number) => void;
}) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
        setCount(data.count || 0);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const criticals = reminders.filter((r) => r.urgency === "critical");

  return (
    <div className="reminder-panel">
      <div className="reminder-header" onClick={() => setExpanded(!expanded)}>
        <div className="reminder-title">
          <Bell size={16} />
          <span>AI Reminders</span>
          {count > 0 && (
            <span className={`reminder-badge ${criticals.length > 0 ? "critical" : ""}`}>
              {count}
            </span>
          )}
        </div>
        <div className="reminder-header-right">
          <button
            className="reminder-refresh"
            onClick={(e) => { e.stopPropagation(); load(); }}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
          </button>
          <span className="reminder-chevron">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="reminder-list">
          {reminders.length === 0 ? (
            <div className="reminder-empty">
              {loading ? (
                <span>Loading reminders...</span>
              ) : (
                <span>No active reminders. Add deadlines to your tenders to get alerts.</span>
              )}
            </div>
          ) : (
            reminders.map((r, i) => {
              const Icon = TYPE_ICONS[r.type] || Bell;
              return (
                <div
                  key={i}
                  className={`reminder-item ${URGENCY_CLASSES[r.urgency]}`}
                  onClick={() => r.tender_id && onSelectTender && onSelectTender(r.tender_id)}
                  style={{ cursor: r.tender_id ? "pointer" : "default" }}
                >
                  <div className="reminder-icon-wrap">
                    <Icon size={14} />
                  </div>
                  <div className="reminder-body">
                    <div className="reminder-msg">{r.message}</div>
                    <div className="reminder-meta">
                      {r.days_left !== null && r.days_left >= 0 && (
                        <span className="reminder-days">{r.days_left}d left</span>
                      )}
                      {r.days_left !== null && r.days_left < 0 && (
                        <span className="reminder-days overdue">{Math.abs(r.days_left)}d overdue</span>
                      )}
                      {r.bid_score !== null && (
                        <span className="reminder-score">Score: {r.bid_score}</span>
                      )}
                    </div>
                  </div>
                  {r.urgency === "critical" && (
                    <AlertTriangle size={14} className="reminder-alert-icon" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ReminderBadge({ count, critical }: { count: number; critical: boolean }) {
  if (count === 0) return null;
  return (
    <span className={`reminder-badge-inline ${critical ? "critical" : ""}`}>{count}</span>
  );
}
