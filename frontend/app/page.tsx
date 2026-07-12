"use client";

import { useEffect, useState } from "react";
import { AuthPage } from "./components/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { apiRequest } from "./api";
import type { Organization, Subscription, TenderDetail, TenderSummary, User } from "./types";

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tenderos_token") ?? "";
    if (saved) setToken(saved);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite) setInviteToken(invite);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadAccount();
    void loadOrganization();
    void loadTenders();
    void loadSubscription();
  }, [token]);

  useEffect(() => {
    if (!token || !user || !inviteToken) return;
    (async () => {
      try {
        await apiRequest(`/invites/${inviteToken}/accept`, { method: "POST" }, token);
        await loadOrganization();
      } catch {
        // invite may be invalid/expired — user can keep using their existing org
      } finally {
        setInviteToken(null);
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, inviteToken]);

  async function loadAccount() {
    try {
      const data = await apiRequest<User>("/me", {}, token);
      setUser(data);
    } catch {
      logout();
    }
  }

  async function loadOrganization() {
    try {
      const data = await apiRequest<Organization>("/orgs/me", {}, token);
      setOrganization(data);
    } catch {
      // non-critical
    }
  }

  async function loadSubscription() {
    try {
      const data = await apiRequest<Subscription>("/subscription", {}, token);
      setSubscription(data);
    } catch {
      // non-critical
    }
  }

  async function loadTenders() {
    try {
      const data = await apiRequest<TenderSummary[]>("/tenders", {}, token);
      setTenders(data);
    } catch {
      // silently fail — dashboard still usable
    }
  }

  function logout() {
    localStorage.removeItem("tenderos_token");
    setToken("");
    setUser(null);
    setOrganization(null);
    setSubscription(null);
    setTenders([]);
    setSelectedTender(null);
  }

  if (!token || !user) {
    return (
      <AuthPage
        onLogin={(t, u) => {
          localStorage.setItem("tenderos_token", t);
          setToken(t);
          setUser(u);
        }}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      token={token}
      organization={organization}
      subscription={subscription}
      tenders={tenders}
      selectedTender={selectedTender}
      setUser={setUser}
      setOrganization={setOrganization}
      setSubscription={setSubscription}
      setTenders={setTenders}
      setSelectedTender={setSelectedTender}
      loadTenders={loadTenders}
      loadSubscription={loadSubscription}
      logout={logout}
    />
  );
}
