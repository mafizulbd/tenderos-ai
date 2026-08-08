"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Locale } from "./translations";

type Dict = (typeof translations)["en"];

type LanguageContextValue = {
  language: Locale;
  setLanguage: (l: Locale) => void;
  t: <NS extends keyof Dict>(ns: NS, key: keyof Dict[NS]) => string;
};

const STORAGE_KEY = "tenderos_ui_lang";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bn") setLanguageState(saved);
  }, []);

  function setLanguage(l: Locale) {
    localStorage.setItem(STORAGE_KEY, l);
    setLanguageState(l);
  }

  function t<NS extends keyof Dict>(ns: NS, key: keyof Dict[NS]): string {
    const dict = translations[language][ns] as Record<string, string>;
    const fallback = translations.en[ns] as Record<string, string>;
    return dict[key as string] ?? fallback[key as string] ?? String(key);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() must be used within <LanguageProvider>");
  return ctx;
}
