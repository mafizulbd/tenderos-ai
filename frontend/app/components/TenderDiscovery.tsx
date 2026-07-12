"use client";
import { useEffect, useState } from "react";
import { Globe, RefreshCw, Download, Search, AlertTriangle, ExternalLink, Calendar } from "lucide-react";

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
  "World Bank": "#0066cc",
  "UNGM": "#009edb",
  "ADB": "#e3001b",
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
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [state, setState] = useState<DiscoveryState>({ running: false, last_run: null, count: 0 });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [error, setError] = useState("");
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function fetchDiscovered(s = search, src = sourceFilter) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (s.trim()) params.set("search", s.trim());
      if (src.trim()) params.set("source", src.trim());
      const res = await fetch(`${API}/discover?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load discovered tenders");
      const data = await res.json();
      setItems(data.tenders || []);
      setState(data.state || { running: false, last_run: null, count: 0 });
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
    setLoading(false);
  }

  async function triggerRefresh() {
    setError("");
    try {
      const res = await fetch(`${API}/discover/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setState(data.state || state);
      setTimeout(() => fetchDiscovered(), 8000);
    } catch (e: any) {
      setError("Refresh failed: " + e.message);
    }
  }

  async function importTender(id: number) {
    setImporting(id);
    try {
      const res = await fetch(`${API}/discover/${id}/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Import failed");
      }
      const tender = await res.json();
      setImportedIds((prev) => new Set([...prev, id]));
      onImported && onImported(tender);
    } catch (e: any) {
      setError(e.message || "Import failed");
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
          <span>AI Tender Discovery</span>
          <span className="discovery-count">{items.length} opportunities</span>
        </div>
        <div className="discovery-actions">
          {state.last_run && (
            <span className="discovery-last-run">
              Last run: {new Date(state.last_run).toLocaleString()}
            </span>
          )}
          <button
            className={`discovery-refresh-btn ${state.running ? "running" : ""}`}
            onClick={triggerRefresh}
            disabled={state.running || loading}
          >
            <RefreshCw size={14} className={state.running ? "spin" : ""} />
            {state.running ? "Scanning..." : "Scan Sources"}
          </button>
        </div>
      </div>

      <div className="discovery-sources">
        <span className="disc-source-label">Sources:</span>
        {["World Bank", "UNGM", "ADB", "UNDP"].map((s) => (
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
          placeholder="Search discovered tenders..."
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
          <span>Loading opportunities from World Bank, UNGM, ADB, UNDP...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="discovery-empty">
          <Globe size={32} className="disc-empty-icon" />
          <div className="disc-empty-title">No tenders discovered yet</div>
          <div className="disc-empty-sub">
            Click "Scan Sources" to fetch live procurement opportunities from World Bank, UNGM, ADB, and UNDP.
          </div>
          <button className="disc-scan-btn" onClick={triggerRefresh}>
            <RefreshCw size={14} /> Start Discovery
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
                      {days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}
                    </span>
                  )}
                </div>

                <div className="disc-item-title">{item.title}</div>

                {item.description && (
                  <div className="disc-item-desc">{item.description.slice(0, 200)}{item.description.length > 200 ? "…" : ""}</div>
                )}

                {item.estimated_value && (
                  <div className="disc-item-value">Est. Value: {item.estimated_value}</div>
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
                      <ExternalLink size={12} /> View Source
                    </a>
                  )}
                  <button
                    className={`disc-import-btn ${isImported ? "imported" : ""}`}
                    disabled={importing === item.id || isImported}
                    onClick={() => importTender(item.id)}
                  >
                    {importing === item.id ? (
                      <><RefreshCw size={12} className="spin" /> Importing...</>
                    ) : isImported ? (
                      <><Download size={12} /> Imported</>
                    ) : (
                      <><Download size={12} /> Add to Library</>
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
