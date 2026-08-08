"use client";

import { useEffect, useState } from "react";
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

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function KnowledgeBasePanel({ token }: Props) {
  const { t } = useLanguage();
  const [kb, setKb] = useState<KnowledgeBase>(EMPTY_KB);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [activeTab, setActiveTab] = useState<"basics" | "projects" | "team" | "equipment" | "certs">("basics");

  useEffect(() => {
    apiRequest<KnowledgeBase>("/me/knowledge-base", {}, token)
      .then((data) => {
        setKb({ ...EMPTY_KB, ...data });
      })
      .catch(() => setKb(EMPTY_KB))
      .finally(() => setLoading(false));
  }, [token]);

  function setField<K extends keyof KnowledgeBase>(key: K, value: KnowledgeBase[K]) {
    setKb((prev) => ({ ...prev, [key]: value }));
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
    setField("past_projects", [...kb.past_projects, p]);
  }
  function updateProject(id: string, field: keyof PastProject, val: string) {
    setField("past_projects", kb.past_projects.map((p) => p.id === id ? { ...p, [field]: val } : p));
  }
  function removeProject(id: string) {
    setField("past_projects", kb.past_projects.filter((p) => p.id !== id));
  }

  // Team
  function addMember() {
    const m: TeamMember = { id: uid(), name: "", role: "", qualification: "", experience: "" };
    setField("technical_team", [...kb.technical_team, m]);
  }
  function updateMember(id: string, field: keyof TeamMember, val: string) {
    setField("technical_team", kb.technical_team.map((m) => m.id === id ? { ...m, [field]: val } : m));
  }
  function removeMember(id: string) {
    setField("technical_team", kb.technical_team.filter((m) => m.id !== id));
  }

  // Equipment
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
    setField("certifications", [...kb.certifications, c]);
  }
  function updateCert(id: string, field: keyof Certification, val: string) {
    setField("certifications", kb.certifications.map((c) => c.id === id ? { ...c, [field]: val } : c));
  }
  function removeCert(id: string) {
    setField("certifications", kb.certifications.filter((c) => c.id !== id));
  }

  if (loading) return <div className="surface kb-panel"><p className="muted">{t("knowledgeBase", "loading")}</p></div>;

  const tabs: { key: typeof activeTab; labelKey: KbKey; count?: number }[] = [
    { key: "basics",    labelKey: "tabBasics" },
    { key: "projects",  labelKey: "tabProjects", count: kb.past_projects.length },
    { key: "team",      labelKey: "tabTeam", count: kb.technical_team.length },
    { key: "equipment", labelKey: "tabEquipment", count: kb.equipment.length },
    { key: "certs",     labelKey: "tabCerts", count: kb.certifications.length },
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
            {kb.past_projects.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noProjectsYet")}</p>
            )}
            {kb.past_projects.map((p) => (
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
            {kb.technical_team.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noTeamYet")}</p>
            )}
            {kb.technical_team.map((m) => (
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
            {kb.certifications.length === 0 && (
              <p className="muted kb-empty">{t("knowledgeBase", "noCertsYet")}</p>
            )}
            {kb.certifications.map((c) => (
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
