"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSearch, XCircle } from "lucide-react";
import { apiRequest } from "../api";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
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
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      }
    })();
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <FileSearch size={28} />
        </div>
        <p className="eyebrow">TenderOS AI</p>
        <h1>Email verification</h1>
      </section>

      <section className="auth-panel">
        {status === "verifying" && <p>Verifying your email…</p>}
        {status === "success" && (
          <>
            <p className="notice">
              <CheckCircle2 size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              Your email is verified.
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              Go to login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="notice error">
              <XCircle size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {message || "This verification link is invalid or has expired."}
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              Back to login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
