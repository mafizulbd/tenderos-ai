"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import { CommentsPanel } from "./CommentsPanel";
import { TasksPanel } from "./TasksPanel";
import type { Contract, ContractStatus, Organization } from "../types";

type Props = {
  contract: Contract;
  token: string;
  organization: Organization | null;
  currentUserId: number;
  onUpdated: (contract: Contract) => void;
  onDeleted: (id: number) => void;
};

const STATUS_OPTIONS: ContractStatus[] = ["draft", "active", "completed", "terminated"];

export function ContractDetail({ contract, token, organization, currentUserId, onUpdated, onDeleted }: Props) {
  const [draft, setDraft] = useState<Contract>(contract);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const canModify =
    organization?.role === "owner" || organization?.role === "admin" || contract.created_by_user_id === currentUserId;

  function update<K extends keyof Contract>(field: K, value: Contract[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiRequest<Contract>(`/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          counterparty_name: draft.counterparty_name,
          contract_value: draft.contract_value,
          currency: draft.currency,
          start_date: draft.start_date,
          end_date: draft.end_date,
          status: draft.status,
          performance_security: draft.performance_security,
          notes: draft.notes,
        }),
      }, token);
      onUpdated(updated);
      setDraft(updated);
      setIsError(false);
      setMessage("Contract saved.");
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete contract "${contract.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiRequest(`/contracts/${contract.id}`, { method: "DELETE" }, token);
      onDeleted(contract.id);
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="surface">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Contract</p>
            <h2>{contract.title}</h2>
          </div>
          {canModify && (
            <button className="icon-btn danger" onClick={remove} disabled={deleting} title="Delete contract">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="field-row">
          <label>
            Title
            <input value={draft.title} onChange={(e) => update("title", e.target.value)} disabled={!canModify} />
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(e) => update("status", e.target.value as ContractStatus)} disabled={!canModify}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>
            Counterparty
            <input value={draft.counterparty_name} onChange={(e) => update("counterparty_name", e.target.value)} disabled={!canModify} placeholder="Procuring entity or client name" />
          </label>
          <label>
            Contract value
            <input value={draft.contract_value} onChange={(e) => update("contract_value", e.target.value)} disabled={!canModify} placeholder="e.g. 5,000,000" />
          </label>
          <label>
            Currency
            <input value={draft.currency} onChange={(e) => update("currency", e.target.value)} disabled={!canModify} />
          </label>
        </div>
        <div className="field-row">
          <label>
            Start date
            <input type="date" value={draft.start_date?.slice(0, 10) ?? ""} onChange={(e) => update("start_date", e.target.value)} disabled={!canModify} />
          </label>
          <label>
            End date
            <input type="date" value={draft.end_date?.slice(0, 10) ?? ""} onChange={(e) => update("end_date", e.target.value)} disabled={!canModify} />
          </label>
        </div>
        <label>
          Performance security
          <input value={draft.performance_security} onChange={(e) => update("performance_security", e.target.value)} disabled={!canModify} placeholder="e.g. 10% bank guarantee" />
        </label>
        <label>
          Notes
          <textarea value={draft.notes} onChange={(e) => update("notes", e.target.value)} disabled={!canModify} />
        </label>

        {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}

        {canModify && (
          <button onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save contract"}
          </button>
        )}
      </section>

      <TasksPanel entityType="contract" entityId={contract.id} token={token} currentUserId={currentUserId} />
      <CommentsPanel entityType="contract" entityId={contract.id} token={token} currentUserId={currentUserId} organization={organization} />
    </>
  );
}
