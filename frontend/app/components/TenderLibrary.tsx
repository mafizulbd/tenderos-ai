"use client";

import { useMemo, useState } from "react";
import { FileText, FolderKanban, Search, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import { formatDate } from "../utils";
import type { TenderSummary } from "../types";

const PAGE_SIZE = 10;

const BID_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  reviewing:  { label: "Reviewing",  cls: "reviewing" },
  submitted:  { label: "Submitted",  cls: "submitted" },
  won:        { label: "Won",        cls: "won" },
  lost:       { label: "Lost",       cls: "lost" },
  "no-bid":   { label: "No Bid",     cls: "no-bid" },
};

type Props = {
  tenders: TenderSummary[];
  selectedId: number | null;
  token: string;
  onSelect: (id: number) => void;
  onDeleted: (id: number) => void;
};

function deadlineCountdown(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { text: "Due today", urgent: true };
  if (diff <= 3) return { text: `${diff}d left`, urgent: true };
  return { text: `${diff}d`, urgent: false };
}

export function TenderLibrary({ tenders, selectedId, token, onSelect, onDeleted }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenders;
    return tenders.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.file_name.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q),
    );
  }, [tenders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm("Delete this tender analysis? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiRequest(`/tenders/${id}`, { method: "DELETE" }, token);
      onDeleted(id);
    } catch {
      // silently keep the item if delete fails
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section id="history" className="surface history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Tender library</p>
          <h2>Recent analyses</h2>
        </div>
        <FolderKanban size={22} />
      </div>

      {tenders.length > 0 && (
        <div className="search-bar">
          <Search size={16} />
          <input
            placeholder="Search by title, file, or content..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      )}

      {paged.length === 0 ? (
        <div className="empty-state compact">
          <FileText size={28} />
          <strong>{search ? "No results" : "No tenders analyzed yet"}</strong>
          <span>
            {search
              ? "Try a different search term."
              : "Upload your first tender to populate this library."}
          </span>
        </div>
      ) : (
        <div className="tender-list">
          {paged.map((tender) => {
            const countdown = deadlineCountdown(tender.deadline);
            const bidInfo = BID_STATUS_LABELS[tender.bid_status] ?? BID_STATUS_LABELS.reviewing;

            return (
              <button
                key={tender.id}
                className={`tender-row ${selectedId === tender.id ? "active" : ""}`}
                onClick={() => onSelect(tender.id)}
              >
                <div className="file-badge">
                  <FileText size={18} />
                </div>

                <div className="tender-row-body">
                  <strong>{tender.title}</strong>
                  <span>{tender.file_name || "Uploaded document"}</span>
                </div>

                <div className="tender-row-meta">
                  <span className={`bid-status-pill ${bidInfo.cls}`}>{bidInfo.label}</span>
                  {tender.bid_score !== null && (
                    <span className={`score-pill ${tender.bid_score >= 70 ? "good" : tender.bid_score >= 50 ? "mid" : "low"}`}>
                      {tender.bid_score}
                    </span>
                  )}
                  {countdown && (
                    <span className={`deadline-pill ${countdown.urgent ? "urgent" : ""}`}>
                      {countdown.text}
                    </span>
                  )}
                </div>

                <small>{formatDate(tender.created_at)}</small>
                <button
                  className="icon-btn danger"
                  title="Delete tender"
                  disabled={deleting === tender.id}
                  onClick={(e) => handleDelete(e, tender.id)}
                >
                  <Trash2 size={15} />
                </button>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
            ‹
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}
