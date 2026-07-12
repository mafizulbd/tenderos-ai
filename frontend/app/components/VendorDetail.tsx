"use client";

import { useState } from "react";
import { Save, Star, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import { CommentsPanel } from "./CommentsPanel";
import { TasksPanel } from "./TasksPanel";
import type { Organization, Vendor } from "../types";

type Props = {
  vendor: Vendor;
  token: string;
  organization: Organization | null;
  currentUserId: number;
  onUpdated: (vendor: Vendor) => void;
  onDeleted: (id: number) => void;
};

export function VendorDetail({ vendor, token, organization, currentUserId, onUpdated, onDeleted }: Props) {
  const [draft, setDraft] = useState<Vendor>(vendor);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const canModify =
    organization?.role === "owner" || organization?.role === "admin" || vendor.created_by_user_id === currentUserId;

  function update(field: keyof Vendor, value: string | number | null) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiRequest<Vendor>(`/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          contact_name: draft.contact_name,
          email: draft.email,
          phone: draft.phone,
          address: draft.address,
          category: draft.category,
          rating: draft.rating,
          notes: draft.notes,
        }),
      }, token);
      onUpdated(updated);
      setDraft(updated);
      setIsError(false);
      setMessage("Vendor saved.");
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiRequest(`/vendors/${vendor.id}`, { method: "DELETE" }, token);
      onDeleted(vendor.id);
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
            <p className="eyebrow">Vendor</p>
            <h2>{vendor.name}</h2>
          </div>
          {canModify && (
            <button className="icon-btn danger" onClick={remove} disabled={deleting} title="Delete vendor">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="field-row">
          <label>
            Name
            <input value={draft.name} onChange={(e) => update("name", e.target.value)} disabled={!canModify} />
          </label>
          <label>
            Category
            <input value={draft.category} onChange={(e) => update("category", e.target.value)} disabled={!canModify} placeholder="Supplier, Subcontractor..." />
          </label>
        </div>
        <div className="field-row">
          <label>
            Contact person
            <input value={draft.contact_name} onChange={(e) => update("contact_name", e.target.value)} disabled={!canModify} />
          </label>
          <label>
            Rating
            <select value={draft.rating ?? ""} onChange={(e) => update("rating", e.target.value ? Number(e.target.value) : null)} disabled={!canModify}>
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} <Star size={10} /></option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>
            Email
            <input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} disabled={!canModify} />
          </label>
          <label>
            Phone
            <input value={draft.phone} onChange={(e) => update("phone", e.target.value)} disabled={!canModify} />
          </label>
        </div>
        <label>
          Address
          <textarea value={draft.address} onChange={(e) => update("address", e.target.value)} disabled={!canModify} />
        </label>
        <label>
          Notes
          <textarea value={draft.notes} onChange={(e) => update("notes", e.target.value)} disabled={!canModify} />
        </label>

        {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}

        {canModify && (
          <button onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save vendor"}
          </button>
        )}
      </section>

      <TasksPanel entityType="vendor" entityId={vendor.id} token={token} currentUserId={currentUserId} />
      <CommentsPanel entityType="vendor" entityId={vendor.id} token={token} currentUserId={currentUserId} organization={organization} />
    </>
  );
}
