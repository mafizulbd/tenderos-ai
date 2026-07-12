"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import type { Certification, Equipment, KnowledgeBase, PastProject, TeamMember } from "../types";
import { EMPTY_KB } from "../types";

type Props = {
  token: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function KnowledgeBasePanel({ token }: Props) {
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
      setMessage("Knowledge base saved successfully.");
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Save failed.");
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

  if (loading) return <div className="surface kb-panel"><p className="muted">Loading knowledge base...</p></div>;

  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: "basics",    label: "Basic Info" },
    { key: "projects",  label: "Past Projects", count: kb.past_projects.length },
    { key: "team",      label: "Technical Team", count: kb.technical_team.length },
    { key: "equipment", label: "Equipment", count: kb.equipment.length },
    { key: "certs",     label: "Certifications", count: kb.certifications.length },
  ];

  return (
    <section id="knowledgebase" className="surface kb-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Company knowledge base</p>
          <h2>Company Profile & Credentials</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Save once — AI uses this in every proposal automatically.
          </p>
        </div>
        <BookOpen size={22} />
      </div>

      <div className="kb-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`kb-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="kb-tab-count">{t.count}</span>
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
                TIN Certificate No.
                <input value={kb.tin} onChange={(e) => setField("tin", e.target.value)} placeholder="Tax Identification Number" />
              </label>
              <label>
                BIN / VAT Registration No.
                <input value={kb.bin} onChange={(e) => setField("bin", e.target.value)} placeholder="Business Identification Number" />
              </label>
            </div>
            <div className="field-row">
              <label>
                Trade License No.
                <input value={kb.trade_license} onChange={(e) => setField("trade_license", e.target.value)} placeholder="Trade License Number" />
              </label>
              <label>
                Trade License Expiry
                <input type="date" value={kb.trade_license_expiry} onChange={(e) => setField("trade_license_expiry", e.target.value)} />
              </label>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Annual Turnover (Last 3 Years)</p>
              <div className="turnover-grid">
                {kb.annual_turnover.map((t, i) => (
                  <label key={i}>
                    {t.year}
                    <input
                      value={t.amount}
                      onChange={(e) => {
                        const updated = [...kb.annual_turnover];
                        updated[i] = { ...t, amount: e.target.value };
                        setField("annual_turnover", updated);
                      }}
                      placeholder="e.g. ৳15 crore"
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
              <p className="muted kb-empty">No past projects added yet. Add your completed projects to strengthen AI proposals.</p>
            )}
            {kb.past_projects.map((p) => (
              <div key={p.id} className="kb-card">
                <div className="kb-card-header">
                  <strong>{p.name || "New Project"}</strong>
                  <button className="icon-btn danger" onClick={() => removeProject(p.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row">
                  <label>
                    Project Name
                    <input value={p.name} onChange={(e) => updateProject(p.id, "name", e.target.value)} placeholder="e.g. Rural Road Construction Phase II" />
                  </label>
                  <label>
                    Client / Employer
                    <input value={p.client} onChange={(e) => updateProject(p.id, "client", e.target.value)} placeholder="e.g. LGED, BWDB, UNDP" />
                  </label>
                </div>
                <div className="field-row field-row-4">
                  <label>
                    Contract Value
                    <input value={p.value} onChange={(e) => updateProject(p.id, "value", e.target.value)} placeholder="৳ crore" />
                  </label>
                  <label>
                    Year
                    <input value={p.year} onChange={(e) => updateProject(p.id, "year", e.target.value)} placeholder="2023" />
                  </label>
                  <label>
                    Duration
                    <input value={p.duration} onChange={(e) => updateProject(p.id, "duration", e.target.value)} placeholder="18 months" />
                  </label>
                  <label>
                    Category
                    <input value={p.category} onChange={(e) => updateProject(p.id, "category", e.target.value)} placeholder="Civil / IT / Supply" />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addProject}><Plus size={15} /> Add Past Project</button>
          </div>
        )}

        {/* ── TEAM ── */}
        {activeTab === "team" && (
          <div className="kb-section">
            {kb.technical_team.length === 0 && (
              <p className="muted kb-empty">No team members added. Add your key personnel — AI will include them in proposals.</p>
            )}
            {kb.technical_team.map((m) => (
              <div key={m.id} className="kb-card">
                <div className="kb-card-header">
                  <strong>{m.name || "New Team Member"}</strong>
                  <button className="icon-btn danger" onClick={() => removeMember(m.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row">
                  <label>
                    Full Name
                    <input value={m.name} onChange={(e) => updateMember(m.id, "name", e.target.value)} placeholder="Engr. Md. Rahman" />
                  </label>
                  <label>
                    Designation / Role
                    <input value={m.role} onChange={(e) => updateMember(m.id, "role", e.target.value)} placeholder="Project Manager, Civil Engineer" />
                  </label>
                </div>
                <div className="field-row">
                  <label>
                    Qualification
                    <input value={m.qualification} onChange={(e) => updateMember(m.id, "qualification", e.target.value)} placeholder="B.Sc Civil Engineering, BUET" />
                  </label>
                  <label>
                    Years of Experience
                    <input value={m.experience} onChange={(e) => updateMember(m.id, "experience", e.target.value)} placeholder="15 years" />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addMember}><Plus size={15} /> Add Team Member</button>
          </div>
        )}

        {/* ── EQUIPMENT ── */}
        {activeTab === "equipment" && (
          <div className="kb-section">
            {kb.equipment.length === 0 && (
              <p className="muted kb-empty">No equipment listed. Add machinery and tools your company owns or rents.</p>
            )}
            {kb.equipment.map((e) => (
              <div key={e.id} className="kb-card kb-card-slim">
                <div className="field-row field-row-4">
                  <label>
                    Equipment Name
                    <input value={e.name} onChange={(ev) => updateEquipment(e.id, "name", ev.target.value)} placeholder="Concrete Mixer, Excavator..." />
                  </label>
                  <label>
                    Quantity
                    <input type="number" min="1" value={e.quantity} onChange={(ev) => updateEquipment(e.id, "quantity", parseInt(ev.target.value) || 1)} />
                  </label>
                  <label>
                    Ownership
                    <select value={e.owned ? "owned" : "rented"} onChange={(ev) => updateEquipment(e.id, "owned", ev.target.value === "owned")}>
                      <option value="owned">Owned</option>
                      <option value="rented">To be Rented</option>
                    </select>
                  </label>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button className="icon-btn danger" onClick={() => removeEquipment(e.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addEquipment}><Plus size={15} /> Add Equipment</button>
          </div>
        )}

        {/* ── CERTIFICATIONS ── */}
        {activeTab === "certs" && (
          <div className="kb-section">
            {kb.certifications.length === 0 && (
              <p className="muted kb-empty">No certifications added. Add ISO, professional, or industry certifications.</p>
            )}
            {kb.certifications.map((c) => (
              <div key={c.id} className="kb-card kb-card-slim">
                <div className="kb-card-header">
                  <strong>{c.name || "New Certification"}</strong>
                  <button className="icon-btn danger" onClick={() => removeCert(c.id)}><Trash2 size={14} /></button>
                </div>
                <div className="field-row field-row-3">
                  <label>
                    Certificate Name
                    <input value={c.name} onChange={(e) => updateCert(c.id, "name", e.target.value)} placeholder="ISO 9001:2015, CIQS..." />
                  </label>
                  <label>
                    Certificate Number
                    <input value={c.number} onChange={(e) => updateCert(c.id, "number", e.target.value)} placeholder="CERT-2023-XXXXX" />
                  </label>
                  <label>
                    Expiry Date
                    <input type="date" value={c.expiry} onChange={(e) => updateCert(c.id, "expiry", e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={addCert}><Plus size={15} /> Add Certification</button>
          </div>
        )}
      </div>

      {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}

      <button className="primary full-button" onClick={save} disabled={saving}>
        <Save size={16} />
        {saving ? "Saving..." : "Save Knowledge Base"}
      </button>
    </section>
  );
}
