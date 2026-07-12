"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ShieldQuestion, XCircle } from "lucide-react";
import { apiRequest } from "../api";
import type { ApprovalRequest, Organization, TenderDetail as TDetail } from "../types";

type Props = {
  tender: TDetail;
  token: string;
  organization: Organization | null;
  onUpdated: (tender: TDetail) => void;
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  none:     { label: "Not submitted for approval", color: "#64748b", icon: ShieldQuestion },
  pending:  { label: "Pending approval",             color: "#d97706", icon: Clock },
  approved: { label: "Approved",                      color: "#16a34a", icon: CheckCircle2 },
  rejected: { label: "Rejected",                      color: "#dc2626", icon: XCircle },
};

export function ApprovalPanel({ tender, token, organization, onUpdated }: Props) {
  const [history, setHistory] = useState<ApprovalRequest[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canDecide = organization?.role === "owner" || organization?.role === "admin";
  const status = tender.approval_status ?? "none";
  const meta = STATUS_META[status] ?? STATUS_META.none;
  const Icon = meta.icon;

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tender.id]);

  async function loadHistory() {
    try {
      const data = await apiRequest<ApprovalRequest[]>(`/tenders/${tender.id}/approval/history`, {}, token);
      setHistory(data);
    } catch {
      // non-critical
    }
  }

  async function refreshTender() {
    const updated = await apiRequest<TDetail>(`/tenders/${tender.id}`, {}, token);
    onUpdated(updated);
    await loadHistory();
  }

  async function act(action: "request" | "cancel" | "decide", decision?: "approved" | "rejected") {
    setLoading(true);
    setError("");
    try {
      if (action === "decide") {
        await apiRequest(`/tenders/${tender.id}/approval/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note }),
        }, token);
        setNote("");
      } else {
        await apiRequest(`/tenders/${tender.id}/approval/${action}`, { method: "POST" }, token);
      }
      await refreshTender();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Workflow</p>
          <h3>Approval</h3>
        </div>
        <Icon size={20} color={meta.color} />
      </div>

      <p style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</p>

      {error && <p className="notice error">{error}</p>}

      <div className="detail-actions">
        {status !== "pending" && (
          <button onClick={() => act("request")} disabled={loading}>
            Request approval
          </button>
        )}
        {status === "pending" && (
          <button onClick={() => act("cancel")} disabled={loading}>
            Cancel request
          </button>
        )}
      </div>

      {status === "pending" && canDecide && (
        <div className="kb-card">
          <label>
            Reviewer note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note for the requester..."
              disabled={loading}
            />
          </label>
          <div className="detail-actions">
            <button className="primary" onClick={() => act("decide", "approved")} disabled={loading}>
              <CheckCircle2 size={16} />
              Approve
            </button>
            <button onClick={() => act("decide", "rejected")} disabled={loading}>
              <XCircle size={16} />
              Reject
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="kb-card">
          <div className="kb-card-header">
            <strong>History</strong>
          </div>
          {history.map((h) => (
            <div key={h.id} className="field-row" style={{ alignItems: "center" }}>
              <div>
                <strong>{STATUS_META[h.status]?.label ?? h.status}</strong>
                {h.reviewer_note && <p className="muted" style={{ fontSize: 13 }}>{h.reviewer_note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
