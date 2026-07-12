"use client";

import { useEffect, useState } from "react";
import { FileSignature, Plus } from "lucide-react";
import { apiRequest } from "../api";
import { formatDate } from "../utils";
import { ContractDetail } from "./ContractDetail";
import type { Contract, ContractStatus, Organization } from "../types";

type Props = {
  token: string;
  organization: Organization | null;
  currentUserId: number;
};

const STATUS_CLASSES: Record<ContractStatus, string> = {
  draft: "reviewing",
  active: "submitted",
  completed: "won",
  terminated: "lost",
};

export function ContractLibrary({ token, organization, currentUserId }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiRequest<Contract[]>(`/contracts?${params.toString()}`, {}, token);
      setContracts(data);
    } catch {
      // non-critical
    }
  }

  async function createContract() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const contract = await apiRequest<Contract>("/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }, token);
      setNewTitle("");
      setShowCreate(false);
      await load();
      setSelected(contract);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create contract.");
    }
  }

  function handleUpdated(contract: Contract) {
    setSelected(contract);
    setContracts((prev) => prev.map((c) => (c.id === contract.id ? contract : c)));
  }

  function handleDeleted(id: number) {
    setSelected(null);
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <section id="contracts" className="library-layout">
      <div className="surface history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Contract tracking</p>
            <h2>Contracts</h2>
          </div>
          <FileSignature size={22} />
        </div>

        <div className="field-row">
          <label>
            Filter by status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
            </select>
          </label>
        </div>

        {error && <p className="notice error">{error}</p>}

        {contracts.length === 0 ? (
          <div className="empty-state compact">
            <FileSignature size={28} />
            <strong>No contracts yet</strong>
            <span>Track signed contracts, renewal dates, and performance security here.</span>
          </div>
        ) : (
          <div className="tender-list">
            {contracts.map((c) => (
              <button
                key={c.id}
                className={`tender-row ${selected?.id === c.id ? "active" : ""}`}
                onClick={() => setSelected(c)}
              >
                <div className="file-badge">
                  <FileSignature size={18} />
                </div>
                <div className="tender-row-body">
                  <strong>{c.title}</strong>
                  <span>{c.counterparty_name || "No counterparty set"}</span>
                </div>
                <div className="tender-row-meta">
                  <span className={`bid-status-pill ${STATUS_CLASSES[c.status]}`}>{c.status}</span>
                </div>
                {c.end_date && <small>Ends {formatDate(c.end_date)}</small>}
              </button>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="kb-card">
            <label>
              Title
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Road Maintenance Agreement" />
            </label>
            <button className="add-btn" onClick={createContract} disabled={!newTitle.trim()}>
              <Plus size={15} />
              Add contract
            </button>
          </div>
        ) : (
          <button className="add-btn" onClick={() => setShowCreate(true)}>
            <Plus size={15} />
            Add contract
          </button>
        )}
      </div>

      <section className="detail-stack">
        {selected ? (
          <ContractDetail
            contract={selected}
            token={token}
            organization={organization}
            currentUserId={currentUserId}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : (
          <section className="surface empty-state">
            <FileSignature size={36} />
            <h2>No contract selected</h2>
            <p className="muted">Click any contract on the left to view or edit it.</p>
          </section>
        )}
      </section>
    </section>
  );
}
