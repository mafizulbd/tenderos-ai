"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import type { Certification, Equipment, KnowledgeBase, PastProject, TeamMember } from "../types";
import { EMPTY_KB } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type Props = {
  token: string;
};

type KbKey = keyof (typeof translations)["en"]["knowledgeBase"];

type ServerRecord = { id: number; [key: string]: unknown };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function KnowledgeBasePanel({ token }: Props) {
  const { t } = useLanguage();
  const [kb, setKb] = useState<KnowledgeBase>(EMPTY_KB);
  const [projects, setProjects] = useState<PastProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [activeTab, setActiveTab] = useState<"basics" | "projects" | "team" | "equipment" | "certs">("basics");

  // Server ids present at last successful load/save, so `save()` can tell
  // which rows the user removed locally and needs to DELETE upstream.
  const projectServerIds = useRef<Set<number>>(new Set());
  const teamServerIds = useRef<Set<number>>(new Set());
  const certServerIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      apiRequest<KnowledgeBase>("/me/knowledge-base", {}, token).catch(() => EMPTY_KB),
      apiRequest<ServerRecord[]>("/company/projects", {}, token).catch(() => []),
      apiRequest<ServerRecord[]>("/company/personnel", {}, token).catch(() => []),
      apiRequest<ServerRecord[]>("/company/certifications", {}, token).catch(() => []),
    ])
      .then(([kbData, projectRows, teamRows, certRows]) => {
        setKb({ ...EMPTY_KB, ...kbData });

        const mappedProjects = projectRows.map((r) => ({
          id: String(r.id), serverId: r.id as number,
          name: r.name as string, client: r.client as string, value: r.value as string,
          year: r.year as string, duration: r.duration as string, category: r.category as string,
        }));
        setProjects(mappedProjects);
        projectServerIds.current = new Set(mappedProjects.map((p) => p.serverId!));

        const mappedTeam = teamRows.map((r) => ({
          id: String(r.id), serverId: r.id as number,
          name: r.name as string, role: r.role as string,
          qualification: r.qualification as string, experience: r.experience as string,
        }));
        setTeam(mappedTeam);
        teamServerIds.current = new Set(mappedTeam.map((m) => m.serverId!));

        const mappedCerts = certRows.map((r) => ({
          id: String(r.id), serverId: r.id as number,
          name: r.name as string, number: r.number as string, expiry: r.expiry as string,
        }));
        setCerts(mappedCerts);
        certServerIds.current = new Set(mappedCerts.map((c) => c.serverId!));
      })
      .finally(() => setLoading(false));
  }, [token]);

  function setField<K extends keyof KnowledgeBase>(key: K, value: KnowledgeBase[K]) {
    setKb((prev) => ({ ...prev, [key]: value }));
  }

  /** Syncs one entity list (create drafts, patch existing rows, delete removed
   * ones) against its /company/* endpoint. Shared across projects/team/certs
   * since all three follow the same create-or-update-then-diff-deletes shape. */
  async function syncEntityList<T extends { id: string; serverId?: number; name: string }>(
    endpoint: string,
    items: T[],
    knownServerIds: React.MutableRefObject<Set<number>>,
    toPayload: (item: T) => Record<string, unknown>,
  ): Promise<T[]> {
    const stillPresent = new Set<number>();
    const synced: T[] = [];

    for (const item of items) {
      const name = item.name.trim();
      if (item.serverId) {
        stillPresent.add(item.serverId);
        await apiRequest(`${endpoint}/${item.serverId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(item)),
        }, token);
        synced.push(item);
      } else if (name) {
        const created = await apiRequest<ServerRecord>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(item)),
        }, token);
        stillPresent.add(created.id);
        synced.push({ ...item, serverId: created.id });
      }
      // Blank-name drafts that were never persisted are silently dropped.
    }

    const removed = [...knownServerIds.current].filter((id) => !stillPresent.has(id));
    await Promise.all(removed.map((id) => apiRequest(`${endpoint}/${id}`, { method: "DELETE" }, token)));

    knownServerIds.current = stillPresent;
    return synced;
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await apiRequest("/me/knowledge-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge_base: kb }),
      }, token);

      setProjects(await syncEntityList("/company/projects", projects, projectServerIds, (p) => ({
        name: p.name, client: p.client, value: p.value, year: p.year, duration: p.duration, category: p.category,
      })));
      setTeam(await syncEntityList("/company/personnel", team, teamServerIds, (m) => ({
        name: m.name, role: m.role, qualification: m.qualification, experience: m.experience,
      })));
      setCerts(await syncEntityList("/company/certifications", certs, certServerIds, (c) => ({
        name: c.name, number: c.number, expiry: c.expiry,
      })));

      setIsError(false);
      setMessage(t("knowledgeBase", "saveSuccess"));
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : t("knowledgeBase", "saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // Past Projects
  function addProject() {
    const p: PastProject = { id: uid(), name: "", client: "", value: "", year: "", duration: "", category: "" };
    setProjects([...projects, p]);
  }
  function updateProject(id: string, field: keyof PastProject, val: string) {
    setProjects(projects.map((p) => p.id === id ? { ...p, [field]: val } : p));
  }
  function removeProject(id: string) {
    setProjects(projects.filter((p) => p.id !== id));
  }

  // Team
  function addMember() {
    const m: TeamMember = { id: uid(), name: "", role: "", qualification: "", experience: "" };
    setTeam([...team, m]);
  }
  function updateMember(id: string, field: keyof TeamMember, val: string) {
    setTeam(team.map((m) => m.id === id ? { ...m, [field]: val } : m));
  }
  function removeMember(id: string) {
    setTeam(team.filter((m) => m.id !== id));
  }

  // Equipment (still blob-backed — not promoted to a table in this pass)
  function addEquipment() {
    const e: Equipment = { id: uid(), name: "", quantity: 1, owned: true };
    setField("equipment", [...kb.equipment, e]);
  }
  function updateEquipment(id: string, field: keyof Equipment, val: string | number | boolean) {
    setField("equipment", kb.equipment.map((e) => e.id === id ? { ...e, [field]: val } : e));
  }
  function removeEquipment(id: string) {
    setField("equipment", kb.equipment.filter((e) => e.id !== id));
  }

  // Certifications
  function addCert() {
    const c: Certification = { id: uid(), name: "", number: "", expiry: "" };
    setCerts([...certs, c]);
  }
  function updateCert(id: string, field: keyof Certification, val: string) {
    setCerts(certs.map((c) => c.id === id ? { ...c, [field]: val } : c));
  }
  function removeCert(id: string) {
    setCerts(certs.filter((c) => c.id !== id));
  }

  if (loading) return <div className="surface kb-panel"><p className="muted">{t("knowledgeBase", "loading")}</p></div>;

  const tabs: { key: typeof activeTab; labelKey: KbKey; count?: number }[] = [
    { key: "basics",    labelKey: "tabBasics" },
    { key: "projects",  labelKey: "tabProjects", count: projects.length },
    { key: "team",      labelKey: "tabTeam", count: team.length },
    { key: "equipment", labelKey: "tabEquipment", count: kb.equipment.length },
    { key: "certs",     labelKey: "tabCerts", count: certs.length },
  ];

  return (
    <section id="knowledgebase" className="surface kb-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("knowledgeBase", "eyebrow")}</p>
          <h2>{t("knowledgeBase", "heading")}</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {t("knowledgeBase", "subtitle")}
          </p>
        </div>
        <BookOpen size={22} />
      </div>

      <div className="kb-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`kb-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t("knowledgeBase", tab.labelKey)}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="kb-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="kb-content">
        {/* ── BASICS ── */}
        {activeTab === "basics" && (
          <div className="kb-section">
            <div className="field-row">
              <label>
                {t("knowledgeBase", "tinLabel")}
                <input value={kb.tin} onChange={(e) => setField("tin", e.target.value)} placeholder={t("knowledgeBase", "tinPlaceholder")} />
              </label>
              <label>
                {t("knowledgeBase", "binLabel")}
                <input value={kb.bin} onChange={(e) => setField("bin", e.target.value)} placeholder={t("knowledgeBase", "binPlaceholder")} />
              </label>
            </div>
            <div className="field-row">
              <label>
                {t("knowledgeBase", "tradeLicenseLabel")}
                <input value={kb.trade_license} onChange={(e) => setField("trade_license", e.target.value)} placeholder={t("knowledgeBase", "tradeLicensePlaceholder")} />
              </label>
              <label>
                {t("knowledgeBase", "tradeLicenseExpiryLabel")}
                <input type="date" value={kb.trade_license_expiry} onChange={(e) => setField("trade_license_expiry", e.target.value)} />
              </label>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t("knowledgeBase", "annualTurnoverHeading")}</p>
              <div className="turnover-grid">
                {kb.annual_turnover.map((yr, i) => (
                  <label key={i}>
                    {yr.year}
                    <input
                      value={yr.amount}
                      onChange={(e) => {
                        const updated = [...kb.annual_turnover];
                        updated[i] = { ...yr, amount: e.target.value };
                        setField("annual_turnover", updated);
                      }}
                      placeholder={t("knowledgeBase", "turnoverPlaceholder")}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PAST PROJECTS ── */}
        {activeTab === "projects" && (
          <div className="kb-section">
            {projects.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noProjectsYet")}</p>
            )}
            {projects.map((p) => (
              <div key={p.id} className="kb-card">
                <div className="kb-card-header">
                  <strong>{p.name || t("knowledgeBase", "newProjectFallback")}</strong>
                  <button className="icon-btn danger" onClick={() => removeProject(p.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row">
                  <label>
                    {t("knowledgeBase", "projectNameLabel")}
                    <input value={p.name} onChange={(e) => updateProject(p.id, "name", e.target.value)} placeholder={t("knowledgeBase", "projectNamePlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "clientLabel")}
                    <input value={p.client} onChange={(e) => updateProject(p.id, "client", e.target.value)} placeholder={t("knowledgeBase", "clientPlaceholder")} />
                  </label>
                </div>
                <div className="field-row field-row-4">
                  <label>
                    {t("knowledgeBase", "contractValueLabel")}
                    <input value={p.value} onChange={(e) => updateProject(p.id, "value", e.target.value)} placeholder={t("knowledgeBase", "contractValuePlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "yearLabel")}
                    <input value={p.year} onChange={(e) => updateProject(p.id, "year", e.target.value)} placeholder={t("knowledgeBase", "yearPlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "durationLabel")}
                    <input value={p.duration} onChange={(e) => updateProject(p.id, "duration", e.target.value)} placeholder={t("knowledgeBase", "durationPlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "categoryLabel")}
                    <input value={p.category} onChange={(e) => updateProject(p.id, "category", e.target.value)} placeholder={t("knowledgeBase", "categoryPlaceholder")} />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addProject}><Plus size={15} /> {t("knowledgeBase", "addPastProject")}</button>
          </div>
        )}

        {/* ── TEAM ── */}
        {activeTab === "team" && (
          <div className="kb-section">
            {team.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noTeamYet")}</p>
            )}
            {team.map((m) => (
              <div key={m.id} className="kb-card">
                <div className="kb-card-header">
                  <strong>{m.name || t("knowledgeBase", "newMemberFallback")}</strong>
                  <button className="icon-btn danger" onClick={() => removeMember(m.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row">
                  <label>
                    {t("knowledgeBase", "fullNameLabel")}
                    <input value={m.name} onChange={(e) => updateMember(m.id, "name", e.target.value)} placeholder={t("knowledgeBase", "fullNamePlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "roleLabel")}
                    <input value={m.role} onChange={(e) => updateMember(m.id, "role", e.target.value)} placeholder={t("knowledgeBase", "rolePlaceholder")} />
                  </label>
                </div>
                <div className="field-row">
                  <label>
                    {t("knowledgeBase", "qualificationLabel")}
                    <input value={m.qualification} onChange={(e) => updateMember(m.id, "qualification", e.target.value)} placeholder={t("knowledgeBase", "qualificationPlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "experienceLabel")}
                    <input value={m.experience} onChange={(e) => updateMember(m.id, "experience", e.target.value)} placeholder={t("knowledgeBase", "experiencePlaceholder")} />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addMember}><Plus size={15} /> {t("knowledgeBase", "addTeamMember")}</button>
          </div>
        )}

        {/* ── EQUIPMENT ── */}
        {activeTab === "equipment" && (
          <div className="kb-section">
            {kb.equipment.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noEquipmentYet")}</p>
            )}
            {kb.equipment.map((e) => (
              <div key={e.id} className="kb-card kb-card-slim">
                <div className="field-row field-row-4">
                  <label>
                    {t("knowledgeBase", "equipmentNameLabel")}
                    <input value={e.name} onChange={(ev) => updateEquipment(e.id, "name", ev.target.value)} placeholder={t("knowledgeBase", "equipmentNamePlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "quantityLabel")}
                    <input type="number" min="1" value={e.quantity} onChange={(ev) => updateEquipment(e.id, "quantity", parseInt(ev.target.value) || 1)} />
                  </label>
                  <label>
                    {t("knowledgeBase", "ownershipLabel")}
                    <select value={e.owned ? "owned" : "rented"} onChange={(ev) => updateEquipment(e.id, "owned", ev.target.value === "owned")}>
                      <option value="owned">{t("knowledgeBase", "ownedOption")}</option>
                      <option value="rented">{t("knowledgeBase", "rentedOption")}</option>
                    </select>
                  </label>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button className="icon-btn danger" onClick={() => removeEquipment(e.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addEquipment}><Plus size={15} /> {t("knowledgeBase", "addEquipment")}</button>
          </div>
        )}

        {/* ── CERTIFICATIONS ── */}
        {activeTab === "certs" && (
          <div className="kb-section">
            {certs.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noCertsYet")}</p>
            )}
            {certs.map((c) => (
              <div key={c.id} className="kb-card kb-card-slim">
                <div className="kb-card-header">
                  <strong>{c.name || t("knowledgeBase", "newCertFallback")}</strong>
                  <button className="icon-btn danger" onClick={() => removeCert(c.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row field-row-3">
                  <label>
                    {t("knowledgeBase", "certNameLabel")}
                    <input value={c.name} onChange={(e) => updateCert(c.id, "name", e.target.value)} placeholder={t("knowledgeBase", "certNamePlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "certNumberLabel")}
                    <input value={c.number} onChange={(e) => updateCert(c.id, "number", e.target.value)} placeholder={t("knowledgeBase", "certNumberPlaceholder")} />
                  </label>
                  <label>
                    {t("knowledgeBase", "expiryDateLabel")}
                    <input type="date" value={c.expiry} onChange={(e) => updateCert(c.id, "expiry", e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addCert}><Plus size={15} /> {t("knowledgeBase", "addCertification")}</button>
          </div>
        )}
      </div>

      {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}

      <button className="primary full-button" onClick={save} disabled={saving}>
        <Save size={16} />
        {saving ? t("knowledgeBase", "saving") : t("knowledgeBase", "saveButton")}
      </button>
    </section>
  );
}
