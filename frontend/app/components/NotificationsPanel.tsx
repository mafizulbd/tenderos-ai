"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Check, CheckCheck, Clock, MessageSquare, RefreshCw, Shield, TrendingUp, UserPlus } from "lucide-react";
import { apiRequest } from "../api";
import type { AppNotification } from "../types";
import { useLanguage } from "../i18n/LanguageContext";

type Props = {
  token: string;
  onSelectEntity?: (entityType: string | null, entityId: number | null) => void;
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  deadline: Clock,
  high_score: TrendingUp,
  cert_expiry: Shield,
  contract_expiry: Shield,
  approval_requested: AlertTriangle,
  approval_decided: CheckCheck,
  task_assigned: Bell,
  comment_added: MessageSquare,
  member_invited: UserPlus,
};

const URGENCY_CLASSES: Record<string, string> = {
  critical: "rem-critical",
  warning: "rem-warning",
  info: "rem-info",
};

export default function NotificationsPanel({ token, onSelectEntity }: Props) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<{ notifications: AppNotification[]; unread_count: number }>(
        "/notifications", {}, token,
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function markRead(n: AppNotification, e: React.MouseEvent) {
    e.stopPropagation();
    if (!n.persisted || !n.id) return;
    try {
      await apiRequest(`/notifications/${n.id}/read`, { method: "POST" }, token);
      await load();
    } catch {
      // non-critical
    }
  }

  async function markAllRead() {
    try {
      await apiRequest("/notifications/read-all", { method: "POST" }, token);
      await load();
    } catch {
      // non-critical
    }
  }

  const criticals = notifications.filter((n) => n.urgency === "critical");

  return (
    <div className="reminder-panel">
      <div className="reminder-header" onClick={() => setExpanded(!expanded)}>
        <div className="reminder-title">
          <Bell size={16} />
          <span>{t("notifications", "title")}</span>
          {unreadCount > 0 && (
            <span className={`reminder-badge ${criticals.length > 0 ? "critical" : ""}`}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="reminder-header-right">
          {unreadCount > 0 && (
            <button
              className="reminder-refresh"
              onClick={(e) => { e.stopPropagation(); markAllRead(); }}
              title={t("notifications", "markAllRead")}
            >
              <CheckCheck size={13} />
            </button>
          )}
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
          {notifications.length === 0 ? (
            <div className="reminder-empty">
              {loading ? <span>{t("notifications", "loading")}</span> : <span>{t("notifications", "allCaughtUp")}</span>}
            </div>
          ) : (
            notifications.map((n, i) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const isRead = n.persisted && n.read_at !== null;
              return (
                <div
                  key={i}
                  className={`reminder-item ${URGENCY_CLASSES[n.urgency] || ""} ${isRead ? "read" : ""}`}
                  onClick={() => onSelectEntity && onSelectEntity(n.entity_type, n.entity_id)}
                  style={{ cursor: n.entity_id ? "pointer" : "default" }}
                >
                  <div className="reminder-icon-wrap">
                    <Icon size={14} />
                  </div>
                  <div className="reminder-body">
                    <div className="reminder-msg">{n.title}</div>
                    {n.message && <div className="reminder-meta">{n.message}</div>}
                    {n.days_left !== undefined && n.days_left !== null && (
                      <div className="reminder-meta">
                        <span className={`reminder-days ${n.days_left < 0 ? "overdue" : ""}`}>
                          {n.days_left < 0
                            ? t("notifications", "daysOverdue", { n: Math.abs(n.days_left) })
                            : t("notifications", "daysLeft", { n: n.days_left })}
                        </span>
                      </div>
                    )}
                  </div>
                  {n.persisted && !isRead && (
                    <button className="icon-btn" title={t("notifications", "markRead")} onClick={(e) => markRead(n, e)}>
                      <Check size={13} />
                    </button>
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
