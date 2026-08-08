"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSearch, ShieldCheck } from "lucide-react";
import { apiRequest } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function resetPassword() {
    setError("");
    if (password.length < 8) {
      setError(t("resetPassword", "passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword", "passwordsMismatch"));
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("resetPassword", "resetFailed"));
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
        <h1>{t("resetPassword", "heading")}</h1>
      </section>

      <section className="auth-panel">
        <LanguageToggle />

        {!token ? (
          <p className="notice error">{t("resetPassword", "missingLink")}</p>
        ) : done ? (
          <>
            <p className="notice">
              <ShieldCheck size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {t("resetPassword", "updatedNotice")}
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              {t("resetPassword", "goToLogin")}
            </Link>
          </>
        ) : (
          <>
            <label>
              {t("resetPassword", "newPasswordLabel")}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
                autoFocus
              />
            </label>
            <label>
              {t("resetPassword", "confirmPasswordLabel")}
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
              />
            </label>
            {error && <p className="notice error">{error}</p>}
            <button className="primary full-button" onClick={resetPassword} disabled={loading}>
              {loading ? t("common", "pleaseWait") : t("resetPassword", "resetButton")}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
