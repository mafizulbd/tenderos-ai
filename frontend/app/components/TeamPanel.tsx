"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, Save, Trash2, Users } from "lucide-react";
import { apiRequest } from "../api";
import type { Organization, OrgInvite, OrgMember, OrgRole } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type Props = {
  token: string;
  organization: Organization | null;
  onOrganizationUpdated: (org: Organization) => void;
};

type TeamKey = keyof (typeof translations)["en"]["team"];

const ROLE_LABEL_KEY: Record<OrgRole, TeamKey> = {
  owner: "roleOwner",
  admin: "roleAdmin",
  member: "roleMember",
};

export function TeamPanel({ token, organization, onOrganizationUpdated }: Props) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [orgName, setOrgName] = useState(organization?.name ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const canManage = organization?.role === "owner" || organization?.role === "admin";
  const isOwner = organization?.role === "owner";

  useEffect(() => {
    setOrgName(organization?.name ?? "");
  }, [organization?.name]);

  useEffect(() => {
    void loadMembers();
    if (canManage) void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organization?.id]);

  async function loadMembers() {
    try {
      const data = await apiRequest<OrgMember[]>("/orgs/me/members", {}, token);
      setMembers(data);
    } catch {
      // non-critical
    }
  }

  async function loadInvites() {
    try {
      const data = await apiRequest<OrgInvite[]>("/orgs/me/invites", {}, token);
      setInvites(data);
    } catch {
      // non-critical
    }
  }

  function notify(text: string, error = false) {
    setIsError(error);
    setMessage(text);
  }

  async function saveOrgName() {
    if (!orgName.trim()) return;
    setLoading(true);
    try {
      const updated = await apiRequest<Organization>("/orgs/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      }, token);
      onOrganizationUpdated({ ...updated, role: organization?.role ?? updated.role });
      notify(t("team", "orgNameSaved"));
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : t("team", "orgNameSaveFailed"), true);
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    setLoading(true);
    try {
      await apiRequest("/orgs/me/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      }, token);
      setInviteEmail("");
      notify(t("team", "inviteCreated", { email }));
      await loadInvites();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : t("team", "inviteFailed"), true);
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(id: number) {
    try {
      await apiRequest(`/orgs/me/invites/${id}`, { method: "DELETE" }, token);
      await loadInvites();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : t("team", "revokeFailed"), true);
    }
  }

  async function changeRole(userId: number, role: OrgRole) {
    try {
      await apiRequest(`/orgs/me/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }, token);
      await loadMembers();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : t("team", "roleUpdateFailed"), true);
    }
  }

  async function removeMember(userId: number) {
    try {
      await apiRequest(`/orgs/me/members/${userId}`, { method: "DELETE" }, token);
      await loadMembers();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : t("team", "removeMemberFailed"), true);
    }
  }

  function copyInviteLink(inviteToken: string) {
    const link = `${window.location.origin}/?invite=${inviteToken}`;
    void navigator.clipboard.writeText(link);
    notify(t("team", "inviteLinkCopied"));
  }

  return (
    <section id="team" className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("team", "eyebrow")}</p>
          <h2>{t("team", "heading")}</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {t("team", "subtitle")}
          </p>
        </div>
        <Users size={22} />
      </div>

      {isOwner && (
        <label>
          {t("team", "orgNameLabel")}
          <div className="field-row">
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <button onClick={saveOrgName} disabled={loading}>
              <Save size={16} />
              {t("team", "save")}
            </button>
          </div>
        </label>
      )}

      <div className="kb-card">
        <div className="kb-card-header">
          <strong>{t("team", "membersHeading", { count: members.length })}</strong>
        </div>
        {members.map((m) => (
          <div key={m.user_id} className="field-row" style={{ alignItems: "center" }}>
            <div>
              <strong>{m.contact_name || m.email}</strong>
              <p className="muted" style={{ fontSize: 13 }}>{m.email}</p>
            </div>
            {canManage && m.role !== "owner" ? (
              <select
                value={m.role}
                onChange={(e) => changeRole(m.user_id, e.target.value as OrgRole)}
              >
                <option value="admin">{t("team", "roleAdmin")}</option>
                <option value="member">{t("team", "roleMember")}</option>
              </select>
            ) : (
              <span className="plan-badge" style={{ background: "#64748b" }}>{t("team", ROLE_LABEL_KEY[m.role])}</span>
            )}
            {canManage && m.role !== "owner" && (
              <button className="icon-btn danger" onClick={() => removeMember(m.user_id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <div className="kb-card">
            <div className="kb-card-header">
              <strong>{t("team", "inviteHeading")}</strong>
            </div>
            <div className="field-row">
              <label>
                {t("team", "emailLabel")}
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t("team", "emailPlaceholder")}
                />
              </label>
              <label>
                {t("team", "roleLabel")}
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
                  <option value="admin">{t("team", "roleAdmin")}</option>
                  <option value="member">{t("team", "roleMember")}</option>
                </select>
              </label>
            </div>
            <button className="add-btn" onClick={sendInvite} disabled={loading}>
              <Mail size={15} />
              {t("team", "sendInvite")}
            </button>
          </div>

          {invites.length > 0 && (
            <div className="kb-card">
              <div className="kb-card-header">
                <strong>{t("team", "pendingInvitesHeading", { count: invites.length })}</strong>
              </div>
              {invites.map((i) => (
                <div key={i.id} className="field-row" style={{ alignItems: "center" }}>
                  <div>
                    <strong>{i.email}</strong>
                    <p className="muted" style={{ fontSize: 13 }}>{t("team", ROLE_LABEL_KEY[i.role])}</p>
                  </div>
                  <button className="icon-btn" onClick={() => copyInviteLink(i.token)} title={t("team", "copyInviteLinkTitle")}>
                    <Copy size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => revokeInvite(i.id)} title={t("team", "revokeInviteTitle")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}
    </section>
  );
}
