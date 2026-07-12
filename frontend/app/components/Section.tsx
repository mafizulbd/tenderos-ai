"use client";

type Props = { title: string; content: string | null | undefined };

export function Section({ title, content }: Props) {
  return (
    <section className="surface result-section">
      <h3>{title}</h3>
      <pre>{content || "Not available"}</pre>
    </section>
  );
}
