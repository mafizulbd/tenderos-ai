"use client";

import { useEffect, useState } from "react";
import { Building, Link2, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import type { TenderVendorLink, Vendor } from "../types";

type Props = {
  tenderId: number;
  token: string;
  canModify: boolean;
};

export function LinkedVendorsPanel({ tenderId, token, canModify }: Props) {
  const [links, setLinks] = useState<TenderVendorLink[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
    if (canModify) void loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  async function load() {
    try {
      const data = await apiRequest<TenderVendorLink[]>(`/tenders/${tenderId}/vendors`, {}, token);
      setLinks(data);
    } catch {
      // non-critical
    }
  }

  async function loadVendors() {
    try {
      const data = await apiRequest<Vendor[]>("/vendors", {}, token);
      setVendors(data);
    } catch {
      // non-critical
    }
  }

  async function link() {
    if (!selectedVendorId) return;
    setError("");
    try {
      await apiRequest(`/tenders/${tenderId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: Number(selectedVendorId), role }),
      }, token);
      setSelectedVendorId("");
      setRole("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not link vendor.");
    }
  }

  async function unlink(vendorId: number) {
    try {
      await apiRequest(`/tenders/${tenderId}/vendors/${vendorId}`, { method: "DELETE" }, token);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not unlink vendor.");
    }
  }

  const linkedIds = new Set(links.map((l) => l.vendor?.id));
  const availableVendors = vendors.filter((v) => !linkedIds.has(v.id));

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Subcontractors & suppliers</p>
          <h3>Linked vendors ({links.length})</h3>
        </div>
        <Building size={20} />
      </div>

      {error && <p className="notice error">{error}</p>}

      {links.map((l) => (
        <div key={l.link_id} className="field-row" style={{ alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <strong>{l.vendor?.name ?? "Unknown vendor"}</strong>
            {l.role && <p className="muted" style={{ fontSize: 13 }}>{l.role}</p>}
          </div>
          {canModify && l.vendor && (
            <button className="icon-btn danger" onClick={() => unlink(l.vendor!.id)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {canModify && (
        <div className="field-row">
          <label>
            Vendor
            <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)}>
              <option value="">Select a vendor...</option>
              {availableVendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <label>
            Role
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Subcontractor, supplier..." />
          </label>
          <button onClick={link} disabled={!selectedVendorId}>
            <Link2 size={15} />
            Link
          </button>
        </div>
      )}
    </section>
  );
}
