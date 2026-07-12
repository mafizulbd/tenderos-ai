"use client";

import { useEffect, useState } from "react";
import { AuthPage } from "./components/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { apiRequest } from "./api";
import type { Subscription, TenderDetail, TenderSummary, User } from "./types";

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tenderos_token") ?? "";
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadAccount();
    void loadTenders();
    void loadSubscription();
  }, [token]);

  async function loadAccount() {
    try {
      const data = await apiRequest<User>("/me", {}, token);
      setUser(data);
    } catch {
      logout();
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
      subscription={subscription}
      tenders={tenders}
      selectedTender={selectedTender}
      setUser={setUser}
      setSubscription={setSubscription}
      setTenders={setTenders}
      setSelectedTender={setSelectedTender}
      loadTenders={loadTenders}
      loadSubscription={loadSubscription}
      logout={logout}
    />
  );
}
