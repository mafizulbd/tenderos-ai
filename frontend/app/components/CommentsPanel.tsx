"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import { formatDate } from "../utils";
import type { Comment, Organization } from "../types";

type Props = {
  entityType: string;
  entityId: number;
  token: string;
  currentUserId: number;
  organization: Organization | null;
};

export function CommentsPanel({ entityType, entityId, token, currentUserId, organization }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canModerate = organization?.role === "owner" || organization?.role === "admin";

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function load() {
    try {
      const data = await apiRequest<Comment[]>(
        `/comments?entity_type=${entityType}&entity_id=${entityId}`, {}, token,
      );
      setComments(data);
    } catch {
      // non-critical
    }
  }

  async function post() {
    const body = draft.trim();
    if (!body) return;
    setLoading(true);
    setError("");
    try {
      await apiRequest("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, body }),
      }, token);
      setDraft("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not post comment.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    try {
      await apiRequest(`/comments/${id}`, { method: "DELETE" }, token);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete comment.");
    }
  }

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Discussion</p>
          <h3>Comments ({comments.length})</h3>
        </div>
        <MessageSquare size={20} />
      </div>

      {error && <p className="notice error">{error}</p>}

      {comments.map((c) => (
        <div key={c.id} className="kb-card kb-card-slim">
          <div className="kb-card-header">
            <div>
              <strong>{c.author_email}</strong>
              <p className="muted" style={{ fontSize: 12 }}>{formatDate(c.created_at)}</p>
            </div>
            {(c.author_user_id === currentUserId || canModerate) && (
              <button className="icon-btn danger" onClick={() => remove(c.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <p>{c.body}</p>
        </div>
      ))}

      <div className="field-row">
        <label style={{ flex: 1 }}>
          Add a comment
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Share an update with your team..."
            disabled={loading}
          />
        </label>
        <button onClick={post} disabled={loading || !draft.trim()}>
          <Send size={16} />
          Post
        </button>
      </div>
    </section>
  );
}
