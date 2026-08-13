"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, FolderKanban, Search, Trash2, UploadCloud } from "lucide-react";
import { apiRequest } from "../api";
import { formatDate } from "../utils";
import type { TenderSummary } from "../types";
import { useLanguage, type TFunction } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

const PAGE_SIZE = 10;

type BidStatusKey = keyof (typeof translations)["en"]["library"];

const BID_STATUS_LABELS: Record<string, { labelKey: BidStatusKey; cls: string }> = {
  reviewing:  { labelKey: "statusReviewing", cls: "reviewing" },
  submitted:  { labelKey: "statusSubmitted", cls: "submitted" },
  won:        { labelKey: "statusWon",       cls: "won" },
  lost:       { labelKey: "statusLost",      cls: "lost" },
  "no-bid":   { labelKey: "statusNoBid",     cls: "no-bid" },
};

type Props = {
  tenders: TenderSummary[];
  selectedId: number | null;
  token: string;
  onSelect: (id: number) => void;
  onDeleted: (id: number) => void;
};

function deadlineCountdown(deadline: string | null, t: TFunction): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { text: t("library", "daysOverdue", { n: Math.abs(diff) }), urgent: true };
  if (diff === 0) return { text: t("library", "dueToday"), urgent: true };
  if (diff <= 3) return { text: t("library", "daysLeft", { n: diff }), urgent: true };
  return { text: t("library", "daysShort", { n: diff }), urgent: false };
}

export function TenderLibrary({ tenders, selectedId, token, onSelect, onDeleted }: Props) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");

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
    if (!confirm(t("library", "deleteConfirm"))) return;
    setDeleting(id);
    setError("");
    try {
      await apiRequest(`/tenders/${id}`, { method: "DELETE" }, token);
      onDeleted(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("library", "deleteFailed"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section id="history" className="surface history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("library", "eyebrow")}</p>
          <h2>{t("library", "heading")}</h2>
        </div>
        <FolderKanban size={22} />
      </div>

      {tenders.length > 0 && (
        <div className="search-bar">
          <Search size={16} />
          <input
            placeholder={t("library", "searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      )}

      {error && <p className="notice error">{error}</p>}

      {paged.length === 0 ? (
        <div className="empty-state compact">
          <FileText size={28} />
          <strong>{search ? t("library", "noResults") : t("library", "noTendersYet")}</strong>
          <span>
            {search ? t("library", "tryDifferentSearch") : t("library", "uploadFirstHint")}
          </span>
          {!search && (
            <Link href="/dashboard#analyze" className="btn-link primary" style={{ marginTop: 12 }}>
              <UploadCloud size={16} />
              {t("library", "uploadTenderLink")}
            </Link>
          )}
        </div>
      ) : (
        <div className="tender-list">
          {paged.map((tender) => {
            const countdown = deadlineCountdown(tender.deadline, t);
            const bidInfo = BID_STATUS_LABELS[tender.bid_status] ?? BID_STATUS_LABELS.reviewing;

            return (
              <div
                key={tender.id}
                role="button"
                tabIndex={0}
                className={`tender-row ${selectedId === tender.id ? "active" : ""}`}
                onClick={() => onSelect(tender.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(tender.id);
                  }
                }}
              >
                <div className="file-badge">
                  <FileText size={18} />
                </div>

                <div className="tender-row-body">
                  <strong>{tender.title}</strong>
                  <span>{tender.file_name || t("library", "uploadedDocumentFallback")}</span>
                </div>

                <div className="tender-row-meta">
                  <span className={`bid-status-pill ${bidInfo.cls}`}>{t("library", bidInfo.labelKey)}</span>
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
                  title={t("library", "deleteTitle")}
                  disabled={deleting === tender.id}
                  onClick={(e) => handleDelete(e, tender.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
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
