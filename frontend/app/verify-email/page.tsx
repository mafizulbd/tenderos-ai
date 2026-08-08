"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSearch, XCircle } from "lucide-react";
import { apiRequest } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("verifyEmail", "missingToken"));
      return;
    }
    (async () => {
      try {
        await apiRequest("/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        setStatus("success");
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : t("verifyEmail", "verificationFailed"));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <FileSearch size={28} />
        </div>
        <p className="eyebrow">TenderOS AI</p>
        <h1>{t("verifyEmail", "heading")}</h1>
      </section>

      <section className="auth-panel">
        <LanguageToggle />

        {status === "verifying" && <p>{t("verifyEmail", "verifying")}</p>}
        {status === "success" && (
          <>
            <p className="notice">
              <CheckCircle2 size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {t("verifyEmail", "verifiedNotice")}
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              {t("verifyEmail", "goToLogin")}
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="notice error">
              <XCircle size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {message || t("verifyEmail", "invalidOrExpired")}
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              {t("verifyEmail", "backToLogin")}
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
