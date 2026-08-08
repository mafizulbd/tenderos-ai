"use client";

import { useRef, useState } from "react";
import { BrainCircuit, Loader, Send, Sparkles } from "lucide-react";
import { API_URL } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  tenderId: number;
  token: string;
};

type SuggestionKey = keyof (typeof translations)["en"]["assistant"];

const SUGGESTIONS: SuggestionKey[] = [
  "suggestedEligibility",
  "suggestedMissingDocs",
  "suggestedEvaluation",
  "suggestedRisky",
  "suggestedBidStrength",
  "suggestedPastProject",
];

export function AssistantPanel({ tenderId, token }: Props) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError("");
    setInput("");
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/tenders/${tenderId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: trimmed, history, language }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail ?? t("assistant", "errorFailed"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const msg = JSON.parse(line.slice(6));

          if (msg.type === "chunk") {
            answer += msg.text;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: answer };
              return next;
            });
          } else if (msg.type === "error") {
            throw new Error(msg.detail);
          } else if (msg.type === "done") {
            return;
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : t("assistant", "errorFailed"));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <section className="surface assistant-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("assistant", "panelEyebrow")}</p>
          <h2>{t("assistant", "panelHeading")}</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t("assistant", "panelSubtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ margin: 0 }}>
            <span className="sr-only">{t("assistant", "languageLabel")}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "auto", marginTop: 0 }}>
              <option value="english">{t("assistant", "englishOption")}</option>
              <option value="bangla">{t("assistant", "banglaOption")}</option>
            </select>
          </label>
          <BrainCircuit size={22} />
        </div>
      </div>

      <div className="assistant-thread">
        {messages.length === 0 ? (
          <div className="assistant-empty">
            <Sparkles size={22} />
            <strong>{t("assistant", "emptyStateTitle")}</strong>
            <span className="muted">{t("assistant", "emptyStateBody")}</span>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((key) => (
                <button key={key} className="assistant-suggestion-chip" onClick={() => ask(t("assistant", key))}>
                  {t("assistant", key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`assistant-message ${m.role}`}>
              <span className="assistant-message-role">{m.role === "user" ? t("assistant", "you") : t("assistant", "assistantName")}</span>
              <p>
                {m.content || (loading && i === messages.length - 1 ? t("assistant", "thinking") : "")}
              </p>
            </div>
          ))
        )}
      </div>

      {error && <p className="notice error">{error}</p>}

      <form
        className="assistant-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("assistant", "inputPlaceholder")}
          disabled={loading}
        />
        <button type="submit" className="primary" disabled={loading || !input.trim()}>
          {loading ? <Loader size={16} className="spinning" /> : <Send size={16} />}
          {t("assistant", "sendButton")}
        </button>
      </form>
    </section>
  );
}
