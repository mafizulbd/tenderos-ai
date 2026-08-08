"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Locale } from "./translations";

type Dict = (typeof translations)["en"];

export type TFunction = <NS extends keyof Dict>(
  ns: NS,
  key: keyof Dict[NS],
  params?: Record<string, string | number>,
) => string;

type LanguageContextValue = {
  language: Locale;
  setLanguage: (l: Locale) => void;
  t: TFunction;
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

  function t<NS extends keyof Dict>(
    ns: NS,
    key: keyof Dict[NS],
    params?: Record<string, string | number>,
  ): string {
    const dict = translations[language][ns] as Record<string, string>;
    const fallback = translations.en[ns] as Record<string, string>;
    let value = dict[key as string] ?? fallback[key as string] ?? String(key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
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
