"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "../api";
import type { Organization, Subscription, TenderDetail, TenderSummary, User } from "../types";

type AppContextValue = {
  token: string;
  user: User | null;
  organization: Organization | null;
  subscription: Subscription | null;
  tenders: TenderSummary[];
  selectedTender: TenderDetail | null;
  setUser: (u: User) => void;
  setOrganization: (o: Organization) => void;
  setSubscription: (s: Subscription) => void;
  setTenders: (ts: TenderSummary[]) => void;
  setSelectedTender: (t: TenderDetail | null) => void;
  loadTenders: () => Promise<void>;
  loadSubscription: () => Promise<void>;
  loadOrganization: () => Promise<void>;
  selectTender: (id: number) => Promise<void>;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function selectTender(id: number) {
    const data = await apiRequest<TenderDetail>(`/tenders/${id}`, {}, token);
    setSelectedTender(data);
  }

  function login(t: string, u: User) {
    localStorage.setItem("tenderos_token", t);
    setToken(t);
    setUser(u);
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

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        organization,
        subscription,
        tenders,
        selectedTender,
        setUser,
        setOrganization,
        setSubscription,
        setTenders,
        setSelectedTender,
        loadTenders,
        loadSubscription,
        loadOrganization,
        selectTender,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used within <AppProvider>");
  return ctx;
}
