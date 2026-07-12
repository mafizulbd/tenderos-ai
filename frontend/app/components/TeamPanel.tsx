"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, Save, Trash2, Users } from "lucide-react";
import { apiRequest } from "../api";
import type { Organization, OrgInvite, OrgMember, OrgRole } from "../types";

type Props = {
  token: string;
  organization: Organization | null;
  onOrganizationUpdated: (org: Organization) => void;
};

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function TeamPanel({ token, organization, onOrganizationUpdated }: Props) {
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
      notify("Organization name saved.");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Could not save organization name.", true);
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
      notify(`Invite created for ${email}.`);
      await loadInvites();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Could not create invite.", true);
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(id: number) {
    try {
      await apiRequest(`/orgs/me/invites/${id}`, { method: "DELETE" }, token);
      await loadInvites();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Could not revoke invite.", true);
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
      notify(err instanceof Error ? err.message : "Could not update role.", true);
    }
  }

  async function removeMember(userId: number) {
    try {
      await apiRequest(`/orgs/me/members/${userId}`, { method: "DELETE" }, token);
      await loadMembers();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Could not remove member.", true);
    }
  }

  function copyInviteLink(inviteToken: string) {
    const link = `${window.location.origin}/?invite=${inviteToken}`;
    void navigator.clipboard.writeText(link);
    notify("Invite link copied to clipboard.");
  }

  return (
    <section id="team" className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Organization</p>
          <h2>Team</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Invite teammates to share tenders, bids, and reports.
          </p>
        </div>
        <Users size={22} />
      </div>

      {isOwner && (
        <label>
          Organization name
          <div className="field-row">
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <button onClick={saveOrgName} disabled={loading}>
              <Save size={16} />
              Save
            </button>
          </div>
        </label>
      )}

      <div className="kb-card">
        <div className="kb-card-header">
          <strong>Members ({members.length})</strong>
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
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <span className="plan-badge" style={{ background: "#64748b" }}>{ROLE_LABELS[m.role]}</span>
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
              <strong>Invite a teammate</strong>
            </div>
            <div className="field-row">
              <label>
                Email
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <label>
                Role
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </label>
            </div>
            <button className="add-btn" onClick={sendInvite} disabled={loading}>
              <Mail size={15} />
              Send invite
            </button>
          </div>

          {invites.length > 0 && (
            <div className="kb-card">
              <div className="kb-card-header">
                <strong>Pending invites ({invites.length})</strong>
              </div>
              {invites.map((i) => (
                <div key={i.id} className="field-row" style={{ alignItems: "center" }}>
                  <div>
                    <strong>{i.email}</strong>
                    <p className="muted" style={{ fontSize: 13 }}>{ROLE_LABELS[i.role]}</p>
                  </div>
                  <button className="icon-btn" onClick={() => copyInviteLink(i.token)} title="Copy invite link">
                    <Copy size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => revokeInvite(i.id)} title="Revoke invite">
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
