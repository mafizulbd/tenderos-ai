"use client";
import { useEffect, useState } from "react";
import { Globe, RefreshCw, Download, Search, AlertTriangle, ExternalLink, Calendar } from "lucide-react";
import { API_URL } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

interface DiscoveredItem {
  id: number;
  source: string;
  external_id: string;
  title: string;
  description: string;
  category: string;
  deadline: string | null;
  estimated_value: string;
  url: string;
  country: string;
  discovered_at: string;
}

interface DiscoveryState {
  running: boolean;
  last_run: string | null;
  count: number;
}

const SOURCE_COLORS: Record<string, string> = {
  "eGP Bangladesh": "#006a4e",
  "World Bank": "#0066cc",
  "UNGM": "#009edb",
  "UNDP": "#0072bc",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function TenderDiscovery({
  token,
  onImported,
}: {
  token: string;
  onImported?: (tender: any) => void;
}) {
  const { t } = useLanguage();
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [state, setState] = useState<DiscoveryState>({ running: false, last_run: null, count: 0 });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [error, setError] = useState("");
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  async function fetchDiscovered(s = search, src = sourceFilter) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (s.trim()) params.set("search", s.trim());
      if (src.trim()) params.set("source", src.trim());
      const res = await fetch(`${API_URL}/discover?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t("discovery", "loadFailed"));
      const data = await res.json();
      setItems(data.tenders || []);
      setState(data.state || { running: false, last_run: null, count: 0 });
    } catch (e: any) {
      setError(e.message || t("discovery", "loadFailedGeneric"));
    }
    setLoading(false);
  }

  async function triggerRefresh() {
    setError("");
    try {
      const res = await fetch(`${API_URL}/discover/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setState(data.state || state);
      setTimeout(() => fetchDiscovered(), 8000);
    } catch (e: any) {
      setError(`${t("discovery", "refreshFailedPrefix")} ${e.message}`);
    }
  }

  async function importTender(id: number) {
    setImporting(id);
    try {
      const res = await fetch(`${API_URL}/discover/${id}/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || t("discovery", "importFailed"));
      }
      const tender = await res.json();
      setImportedIds((prev) => new Set([...prev, id]));
      onImported && onImported(tender);
    } catch (e: any) {
      setError(e.message || t("discovery", "importFailed"));
    }
    setImporting(null);
  }

  useEffect(() => {
    fetchDiscovered();
  }, [token]);

  const sources = Array.from(new Set(items.map((i) => i.source))).filter(Boolean);

  return (
    <div className="discovery-panel" id="discovery">
      <div className="discovery-header">
        <div className="discovery-title">
          <Globe size={18} />
          <span>{t("discovery", "heading")}</span>
          <span className="discovery-count">{t("discovery", "opportunitiesCount", { count: items.length })}</span>
        </div>
        <div className="discovery-actions">
          {state.last_run && (
            <span className="discovery-last-run">
              {t("discovery", "lastRun", { time: new Date(state.last_run).toLocaleString() })}
            </span>
          )}
          <button
            className={`discovery-refresh-btn ${state.running ? "running" : ""}`}
            onClick={triggerRefresh}
            disabled={state.running || loading}
          >
            <RefreshCw size={14} className={state.running ? "spin" : ""} />
            {state.running ? t("discovery", "scanning") : t("discovery", "scanSources")}
          </button>
        </div>
      </div>

      <div className="discovery-sources">
        <span className="disc-source-label">{t("discovery", "sourcesLabel")}</span>
        {["eGP Bangladesh", "World Bank", "UNGM", "UNDP"].map((s) => (
          <button
            key={s}
            className={`disc-source-chip ${sourceFilter === s ? "active" : ""}`}
            style={{ borderColor: SOURCE_COLORS[s] || "#666" }}
            onClick={() => {
              const next = sourceFilter === s ? "" : s;
              setSourceFilter(next);
              fetchDiscovered(search, next);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="discovery-search">
        <Search size={14} className="disc-search-icon" />
        <input
          className="disc-search-input"
          placeholder={t("discovery", "searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchDiscovered(e.target.value, sourceFilter);
          }}
        />
      </div>

      {error && (
        <div className="discovery-error">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="discovery-loading">
          <div className="spinner-ring" />
          <span>{t("discovery", "loadingOpportunities")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="discovery-empty">
          <Globe size={32} className="disc-empty-icon" />
          <div className="disc-empty-title">{t("discovery", "emptyTitle")}</div>
          <div className="disc-empty-sub">{t("discovery", "emptySub")}</div>
          <button className="disc-scan-btn" onClick={triggerRefresh}>
            <RefreshCw size={14} /> {t("discovery", "startDiscovery")}
          </button>
        </div>
      ) : (
        <div className="discovery-list">
          {items.map((item) => {
            const days = daysUntil(item.deadline);
            const isImported = importedIds.has(item.id);
            return (
              <div key={item.id} className="discovery-item">
                <div className="disc-item-header">
                  <span
                    className="disc-source-badge"
                    style={{ background: SOURCE_COLORS[item.source] || "#555" }}
                  >
                    {item.source}
                  </span>
                  {item.category && (
                    <span className="disc-category">{item.category}</span>
                  )}
                  {days !== null && (
                    <span className={`disc-deadline ${days <= 3 ? "urgent" : days <= 7 ? "soon" : ""}`}>
                      <Calendar size={11} />
                      {days < 0
                        ? t("discovery", "daysAgo", { n: Math.abs(days) })
                        : t("discovery", "daysLeft", { n: days })}
                    </span>
                  )}
                </div>

                <div className="disc-item-title">{item.title}</div>

                {item.description && (
                  <div className="disc-item-desc">{item.description.slice(0, 200)}{item.description.length > 200 ? "…" : ""}</div>
                )}

                {item.estimated_value && (
                  <div className="disc-item-value">{t("discovery", "estValue", { value: item.estimated_value })}</div>
                )}

                <div className="disc-item-footer">
                  {item.url && (
                    <a
                      className="disc-ext-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} /> {t("discovery", "viewSource")}
                    </a>
                  )}
                  <button
                    className={`disc-import-btn ${isImported ? "imported" : ""}`}
                    disabled={importing === item.id || isImported}
                    onClick={() => importTender(item.id)}
                  >
                    {importing === item.id ? (
                      <><RefreshCw size={12} className="spin" /> {t("discovery", "importing")}</>
                    ) : isImported ? (
                      <><Download size={12} /> {t("discovery", "imported")}</>
                    ) : (
                      <><Download size={12} /> {t("discovery", "addToLibrary")}</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
