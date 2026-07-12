"use client";

import { useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { apiRequest } from "../api";
import type { User } from "../types";

type Props = {
  user: User;
  token: string;
  onUpdate: (user: User) => void;
};

export function ProfilePanel({ user, token, onUpdate }: Props) {
  const [draft, setDraft] = useState<User>(user);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function update(field: keyof User, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const updated = await apiRequest<User>("/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: draft.contact_name,
          phone: draft.phone,
          address: draft.address,
        }),
      }, token);
      onUpdate(updated);
      setDraft(updated);
      setIsError(false);
      setMessage("Profile saved.");
    } catch (err: unknown) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="profile" className="surface profile-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Bidder context</p>
          <h2>Company profile</h2>
        </div>
        <Building2 size={22} />
      </div>

      <p className="muted" style={{ marginTop: "-0.5rem" }}>
        Organization name is managed by the org owner under <strong>Team</strong>.
      </p>
      <label>
        Contact person
        <input value={draft.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
      </label>
      <label>
        Phone
        <input value={draft.phone} onChange={(e) => update("phone", e.target.value)} />
      </label>
      <label>
        Address
        <textarea value={draft.address} onChange={(e) => update("address", e.target.value)} />
      </label>

      {message && <p className={`notice ${isError ? "error" : ""}`}>{message}</p>}

      <button onClick={save} disabled={loading}>
        <ShieldCheck size={18} />
        {loading ? "Saving..." : "Save profile"}
      </button>
    </section>
  );
}
