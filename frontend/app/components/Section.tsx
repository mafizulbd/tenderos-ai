"use client";

import { useLanguage } from "../i18n/LanguageContext";

type Props = { title: string; content: string | null | undefined };

export function Section({ title, content }: Props) {
  const { t } = useLanguage();
  return (
    <section className="surface result-section">
      <h3>{title}</h3>
      <pre>{content || t("section", "notAvailable")}</pre>
    </section>
  );
}
