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
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

type AuthMode = "login" | "signup" | "forgot";

type Props = {
  onLogin: (token: string, user: User) => void;
};

export function AuthPage({ onLogin }: Props) {
  const { t } = useLanguage();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

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
      setError(err instanceof Error ? err.message : t("auth", "authFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setForgotSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth", "resetFailed"));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setError("");
    setForgotSent(false);
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <FileSearch size={28} />
        </div>
        <p className="eyebrow">TenderOS AI</p>
        <h1>{t("auth", "heroTitle")}</h1>
        <p>{t("auth", "heroSubtitle")}</p>
        <div className="auth-points">
          <span>
            <ShieldCheck size={18} /> {t("auth", "pointPrivateLibrary")}
          </span>
          <span>
            <CheckCircle2 size={18} /> {t("auth", "pointComplianceMatrix")}
          </span>
          <span>
            <ArrowDownToLine size={18} /> {t("auth", "pointDocxExport")}
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <LanguageToggle />

        {authMode !== "forgot" && (
          <div className="segmented">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              {t("auth", "login")}
            </button>
            <button
              className={authMode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              {t("auth", "signup")}
            </button>
          </div>
        )}

        {authMode === "forgot" ? (
          forgotSent ? (
            <>
              <p className="notice">
                {t("auth", "resetSentPrefix")} <strong>{email}</strong>, {t("auth", "resetSentSuffix")}
              </p>
              <button className="primary full-button" onClick={() => switchMode("login")}>
                {t("auth", "backToLogin")}
              </button>
            </>
          ) : (
            <>
              <label>
                {t("auth", "email")}
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && requestPasswordReset()}
                  autoFocus
                />
              </label>
              {error && <p className="notice error">{error}</p>}
              <button
                className="primary full-button"
                onClick={requestPasswordReset}
                disabled={loading || !email}
              >
                {loading ? t("common", "pleaseWait") : t("auth", "sendResetLink")}
              </button>
              <button className="link-button" onClick={() => switchMode("login")}>
                {t("auth", "backToLogin")}
              </button>
            </>
          )
        ) : (
          <>
            <label>
              {t("auth", "email")}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && authenticate()}
              />
            </label>

            <label>
              {t("auth", "password")}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && authenticate()}
              />
            </label>

            {authMode === "login" && (
              <button className="link-button" onClick={() => switchMode("forgot")}>
                {t("auth", "forgotPassword")}
              </button>
            )}

            {error && <p className="notice error">{error}</p>}

            <button className="primary full-button" onClick={authenticate} disabled={loading}>
              <UserRound size={18} />
              {loading ? t("common", "pleaseWait") : authMode === "login" ? t("auth", "login") : t("auth", "createAccount")}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
