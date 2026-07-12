"use client";

import { useEffect, useState } from "react";
import { Building, Plus, Search, Star, Users } from "lucide-react";
import { apiRequest } from "../api";
import { VendorDetail } from "./VendorDetail";
import type { Organization, Vendor } from "../types";

type Props = {
  token: string;
  organization: Organization | null;
  currentUserId: number;
};

export function VendorLibrary({ token, organization, currentUserId }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search]);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const data = await apiRequest<Vendor[]>(`/vendors?${params.toString()}`, {}, token);
      setVendors(data);
    } catch {
      // non-critical
    }
  }

  async function createVendor() {
    const name = newName.trim();
    if (!name) return;
    try {
      const vendor = await apiRequest<Vendor>("/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: newCategory.trim() }),
      }, token);
      setNewName("");
      setNewCategory("");
      setShowCreate(false);
      await load();
      setSelected(vendor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create vendor.");
    }
  }

  function handleUpdated(vendor: Vendor) {
    setSelected(vendor);
    setVendors((prev) => prev.map((v) => (v.id === vendor.id ? vendor : v)));
  }

  function handleDeleted(id: number) {
    setSelected(null);
    setVendors((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <section id="vendors" className="library-layout">
      <div className="surface history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Vendor management</p>
            <h2>Vendors</h2>
          </div>
          <Users size={22} />
        </div>

        <div className="search-bar">
          <Search size={16} />
          <input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {error && <p className="notice error">{error}</p>}

        {vendors.length === 0 ? (
          <div className="empty-state compact">
            <Building size={28} />
            <strong>No vendors yet</strong>
            <span>Add subcontractors and suppliers to track and link them to tenders.</span>
          </div>
        ) : (
          <div className="tender-list">
            {vendors.map((v) => (
              <button
                key={v.id}
                className={`tender-row ${selected?.id === v.id ? "active" : ""}`}
                onClick={() => setSelected(v)}
              >
                <div className="file-badge">
                  <Building size={18} />
                </div>
                <div className="tender-row-body">
                  <strong>{v.name}</strong>
                  <span>{v.category || "Uncategorized"}</span>
                </div>
                {v.rating !== null && (
                  <div className="tender-row-meta">
                    <span className="score-pill good">
                      {v.rating} <Star size={12} />
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="kb-card">
            <div className="field-row">
              <label>
                Name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor name" />
              </label>
              <label>
                Category
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Supplier, Subcontractor..." />
              </label>
            </div>
            <button className="add-btn" onClick={createVendor} disabled={!newName.trim()}>
              <Plus size={15} />
              Add vendor
            </button>
          </div>
        ) : (
          <button className="add-btn" onClick={() => setShowCreate(true)}>
            <Plus size={15} />
            Add vendor
          </button>
        )}
      </div>

      <section className="detail-stack">
        {selected ? (
          <VendorDetail
            vendor={selected}
            token={token}
            organization={organization}
            currentUserId={currentUserId}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : (
          <section className="surface empty-state">
            <Building size={36} />
            <h2>No vendor selected</h2>
            <p className="muted">Click any vendor on the left to view or edit their profile.</p>
          </section>
        )}
      </section>
    </section>
  );
}
