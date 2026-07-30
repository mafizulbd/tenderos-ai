"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSearch, ShieldCheck } from "lucide-react";
import { apiRequest } from "../api";

export default function ResetPasswordPage() {
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
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
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
      setError(err instanceof Error ? err.message : "Could not reset password.");
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
        <h1>Reset your password</h1>
      </section>

      <section className="auth-panel">
        {!token ? (
          <p className="notice error">Missing or invalid reset link. Request a new one from the login page.</p>
        ) : done ? (
          <>
            <p className="notice">
              <ShieldCheck size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              Password updated. You can now log in.
            </p>
            <Link href="/" className="primary full-button" style={{ textAlign: "center" }}>
              Go to login
            </Link>
          </>
        ) : (
          <>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
                autoFocus
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
              />
            </label>
            {error && <p className="notice error">{error}</p>}
            <button className="primary full-button" onClick={resetPassword} disabled={loading}>
              {loading ? "Please wait..." : "Reset password"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
