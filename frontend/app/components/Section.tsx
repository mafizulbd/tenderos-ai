"use client";

import { useLanguage } from "../i18n/LanguageContext";

type Props = { title: string; content: string | null | undefined };

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export function Section({ title, content }: Props) {
  const { t } = useLanguage();
  return (
    <section className="surface result-section">
      <h3>{title}</h3>
      <pre>{content ? renderBold(content) : t("section", "notAvailable")}</pre>
    </section>
  );
}
