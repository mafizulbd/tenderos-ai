"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiRequest } from "../api";
import type { User } from "../types";

type AuthMode = "login" | "signup";

type Props = {
  onLogin: (token: string, user: User) => void;
};

export function AuthPage({ onLogin }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function authenticate() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ token: string; user: User }>(`/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setPassword("");
      onLogin(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <FileSearch size={28} />
        </div>
        <p className="eyebrow">TenderOS AI</p>
        <h1>Tender command center for suppliers</h1>
        <p>
          Analyze tender documents, extract compliance requirements, and prepare a submission
          draft inside a private workspace.
        </p>
        <div className="auth-points">
          <span>
            <ShieldCheck size={18} /> Private tender library
          </span>
          <span>
            <CheckCircle2 size={18} /> Compliance matrix
          </span>
          <span>
            <ArrowDownToLine size={18} /> DOCX report export
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="segmented">
          <button
            className={authMode === "login" ? "active" : ""}
            onClick={() => setAuthMode("login")}
          >
            Login
          </button>
          <button
            className={authMode === "signup" ? "active" : ""}
            onClick={() => setAuthMode("signup")}
          >
            Sign up
          </button>
        </div>

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
          />
        </label>

        {error && <p className="notice error">{error}</p>}

        <button className="primary full-button" onClick={authenticate} disabled={loading}>
          <UserRound size={18} />
          {loading ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}
        </button>
      </section>
    </main>
  );
}
