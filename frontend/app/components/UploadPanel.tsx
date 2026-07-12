"use client";

import { useRef, useState } from "react";
import { FileSearch, UploadCloud, Zap } from "lucide-react";
import { API_URL } from "../api";
import { formatBytes } from "../utils";
import type { Subscription, TenderDetail } from "../types";

type ProgressStage = "analyzing" | "saving" | "";

type Props = {
  token: string;
  subscription: Subscription | null;
  onComplete: (tender: TenderDetail) => void;
  onTendersChanged: () => Promise<void>;
};

export function UploadPanel({ token, subscription, onComplete, onTendersChanged }: Props) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("english");
  const [deadline, setDeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<ProgressStage>("");
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const isUnlimited = subscription?.is_unlimited ?? false;
  const used = subscription?.monthly_tenders_used ?? 0;
  const limit = subscription?.monthly_limit ?? 5;
  const limitReached = !isUnlimited && used >= limit;
  const nearLimit = !isUnlimited && !limitReached && used >= limit - 1;

  async function analyze() {
    if (!title.trim() || !file) {
      setError("Enter a tender title and upload a PDF, DOCX, or TXT file.");
      return;
    }

    setLoading(true);
    setError("");
    setStage("analyzing");
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("language", language);
      formData.append("deadline", deadline);
      formData.append("file", file);

      const response = await fetch(`${API_URL}/tenders/analyze-stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail ?? `Backend error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const msg = JSON.parse(line.slice(6));

          if (msg.type === "progress") {
            setStage(msg.stage as ProgressStage);
          } else if (msg.type === "chunk") {
            setStreamText((prev) => prev + msg.text);
          } else if (msg.type === "done") {
            setTitle("");
            setDeadline("");
            setFile(null);
            setStage("");
            setStreamText("");
            onComplete(msg.tender as TenderDetail);
            await onTendersChanged();
            return;
          } else if (msg.type === "error") {
            throw new Error(msg.detail);
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage("");
      setStreamText("");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setLoading(false);
    setStage("");
    setStreamText("");
  }

  const stageLabel: Record<ProgressStage, string> = {
    analyzing: "AI is analyzing your tender document...",
    saving: "Saving results to your library...",
    "": "",
  };

  return (
    <section id="analyze" className="surface upload-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">New analysis</p>
          <h2>Analyze tender document</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      {limitReached && (
        <div className="limit-banner">
          <Zap size={15} />
          <span>
            Monthly limit reached ({limit} analyses on Free plan).{" "}
            <a href="mailto:support@tenderos.ai?subject=Upgrade%20to%20Pro">
              Upgrade to Pro — ৳999/month
            </a>{" "}
            for unlimited analyses.
          </span>
        </div>
      )}

      {nearLimit && (
        <p className="notice warn">
          {limit - used} analysis remaining this month.{" "}
          <a href="mailto:support@tenderos.ai?subject=Upgrade%20to%20Pro">Upgrade to Pro</a> for unlimited.
        </p>
      )}

      {!loading ? (
        <>
          <label>
            Tender title <span className="req">*</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. LGED Road Construction Tender 2025" />
          </label>

          <div className="field-row">
            <label>
              Output language
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="english">English</option>
                <option value="bangla">বাংলা (Bangla)</option>
              </select>
            </label>
            <label>
              Submission deadline
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>

          <label>
            Tender file <span className="req">*</span>
            <input
              type="file"
              accept=".txt,.pdf,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="upload-drop">
            <FileSearch size={24} />
            <div>
              <strong>{file ? file.name : "PDF, DOCX, or TXT up to 15 MB"}</strong>
              <span>
                {file
                  ? formatBytes(file.size)
                  : "9-section Bangladesh-specific AI analysis including bid recommendation & score."}
              </span>
            </div>
          </div>

          {error && <p className="notice error">{error}</p>}

          <button
            className="primary full-button"
            onClick={analyze}
            disabled={limitReached}
          >
            <FileSearch size={18} />
            Analyze tender
          </button>
        </>
      ) : (
        <div className="stream-panel">
          <div className="stream-stages">
            <span className={`stage-pill ${stage === "analyzing" ? "active" : stage === "saving" || streamText ? "done" : ""}`}>
              1. Analyzing
            </span>
            <span className="stage-sep">›</span>
            <span className={`stage-pill ${stage === "saving" ? "active" : ""}`}>
              2. Saving
            </span>
          </div>

          {stageLabel[stage] && (
            <p className="stream-status">
              <span className="spinner" /> {stageLabel[stage]}
            </p>
          )}

          {streamText && (
            <textarea
              className="stream-output"
              readOnly
              value={streamText}
            />
          )}

          <button onClick={cancel} className="cancel-btn">
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
