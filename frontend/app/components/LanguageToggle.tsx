"use client";

import { useLanguage } from "../i18n/LanguageContext";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`lang-toggle ${className}`.trim()} role="group" aria-label="Language">
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "bn" ? "active" : ""}
        onClick={() => setLanguage("bn")}
      >
        বাংলা
      </button>
    </div>
  );
}
