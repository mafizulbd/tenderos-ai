"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "../api";
import { formatDate } from "../utils";
import type { OrgMember, Task, TaskStatus } from "../types";

type Props = {
  entityType: string;
  entityId: number;
  token: string;
  currentUserId: number;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function TasksPanel({ entityType, entityId, token, currentUserId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function load() {
    try {
      const data = await apiRequest<Task[]>(
        `/tasks?entity_type=${entityType}&entity_id=${entityId}`, {}, token,
      );
      setTasks(data);
    } catch {
      // non-critical
    }
  }

  async function loadMembers() {
    try {
      const data = await apiRequest<OrgMember[]>("/orgs/me/members", {}, token);
      setMembers(data);
    } catch {
      // non-critical
    }
  }

  async function create() {
    const t = title.trim();
    if (!t) return;
    setLoading(true);
    setError("");
    try {
      await apiRequest("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          title: t,
          assignee_user_id: assigneeId ? Number(assigneeId) : null,
          due_date: dueDate || null,
        }),
      }, token);
      setTitle("");
      setAssigneeId("");
      setDueDate("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }, token);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update task.");
    }
  }

  async function remove(id: number) {
    try {
      await apiRequest(`/tasks/${id}`, { method: "DELETE" }, token);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete task.");
    }
  }

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Follow-ups</p>
          <h3>Tasks ({tasks.length})</h3>
        </div>
        <CheckSquare size={20} />
      </div>

      {error && <p className="notice error">{error}</p>}

      {tasks.map((t) => (
        <div key={t.id} className="field-row" style={{ alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <strong style={{ textDecoration: t.status === "done" ? "line-through" : "none" }}>
              {t.title}
            </strong>
            <p className="muted" style={{ fontSize: 12 }}>
              {t.assignee_email ? `Assigned to ${t.assignee_email}` : "Unassigned"}
              {t.due_date && <> &nbsp;·&nbsp; Due {formatDate(t.due_date)}</>}
            </p>
          </div>
          <select value={t.status} onChange={(e) => updateStatus(t, e.target.value as TaskStatus)}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {(t.created_by_user_id === currentUserId) && (
            <button className="icon-btn danger" onClick={() => remove(t.id)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      <div className="kb-card">
        <div className="field-row">
          <label>
            New task
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Prepare bid security" />
          </label>
          <label>
            Assignee
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.email}</option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <button className="add-btn" onClick={create} disabled={loading || !title.trim()}>
          <Plus size={15} />
          Add task
        </button>
      </div>
    </section>
  );
}
