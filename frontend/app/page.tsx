"use client";

import { useState } from "react";
import "./globals.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export default function Home() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeTender() {
    if (!title || !file) {
      alert("Please enter title and upload a tender file.");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/tenders/analyze`, {
        method: "POST",
        body: formData,
      });

     const text = await response.text();

    if (!response.ok) {
     throw new Error(`Backend error ${response.status}: ${text}`);
    }
  
   const data = JSON.parse(text);
   setResult(data);

    } catch (error) {
      setResult({
        error: "Failed to connect backend."
      });
    } finally {
      setLoading(false);
    }
  }

  function Section({ title, content }: { title: string; content: string }) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <pre>{content || "Not available"}</pre>
      </div>
    );
  }

  return (
    <main className="container">
      <section className="hero">
        <h1>TenderOS AI</h1>
        <p>AI-powered Tender Analysis and Draft Submission Platform</p>
      </section>

      <section className="card">
        <h2>Upload Tender Document</h2>

        <input
          type="text"
          placeholder="Tender title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="file"
          accept=".txt,.pdf,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button onClick={analyzeTender}>
          {loading ? "Analyzing Tender..." : "Analyze Tender"}
        </button>
      </section>

      {result?.error && (
        <section className="card">
          <h2>Error</h2>
          <pre>{result.error}</pre>
        </section>
      )}

      {result && !result.error && (
        <>
          <Section title="Executive Summary" content={result.summary} />
          <Section title="Eligibility Criteria" content={result.eligibility} />
          <Section title="Required Documents" content={result.required_documents} />
          <Section title="Compliance Matrix" content={result.compliance_matrix} />
          <Section title="Risk Analysis" content={result.risk_analysis} />
          <Section title="Technical Proposal Draft" content={result.proposal_draft} />
          <Section title="Final Submission Checklist" content={result.final_checklist} />

          <a
            href={`${API_URL}/tenders/${result.id}/export-docx`}
            target="_blank"
          >
            <button>Download DOCX Report</button>
          </a>
        </>
      )}
    </main>
  );
}
