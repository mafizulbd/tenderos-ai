"use client";
import { useRef, useState } from "react";
import { ShieldCheck, Upload, AlertTriangle, CheckCircle, XCircle, Clock, FileText } from "lucide-react";

interface ValidationResult {
  filename: string;
  document_type: string;
  document_number: string;
  issuing_authority: string;
  holder_name: string;
  issue_date: string;
  expiry_date: string;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "CANNOT_DETERMINE";
  validity_notes: string;
  warnings: string[];
}

const STATUS_CONFIG = {
  VALID: { icon: CheckCircle, label: "Valid", cls: "doc-status-valid" },
  EXPIRING_SOON: { icon: Clock, label: "Expiring Soon", cls: "doc-status-warning" },
  EXPIRED: { icon: XCircle, label: "Expired", cls: "doc-status-expired" },
  CANNOT_DETERMINE: { icon: AlertTriangle, label: "Cannot Determine", cls: "doc-status-unknown" },
};

export default function DocumentValidator({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function validate(file: File) {
    setLoading(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/documents/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Validation failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Validation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validate(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validate(file);
    e.target.value = "";
  }

  const cfg = result ? STATUS_CONFIG[result.status] || STATUS_CONFIG.CANNOT_DETERMINE : null;
  const StatusIcon = cfg?.icon;

  return (
    <div className="doc-validator">
      <div className="section-header">
        <ShieldCheck size={18} />
        <span>AI Document Validator</span>
      </div>

      <div
        className={`doc-drop-zone ${dragging ? "dragging" : ""} ${loading ? "loading" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" onChange={handleFile} hidden />
        {loading ? (
          <div className="doc-loading">
            <div className="spinner-ring" />
            <span>AI is analyzing your document...</span>
          </div>
        ) : (
          <>
            <Upload size={28} className="doc-drop-icon" />
            <div className="doc-drop-title">Drop document here or click to upload</div>
            <div className="doc-drop-sub">Supports: PDF, JPG, PNG, WEBP · Trade License · TIN · VAT · Certificates</div>
          </>
        )}
      </div>

      {error && (
        <div className="doc-error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && cfg && StatusIcon && (
        <div className="doc-result">
          <div className={`doc-status-badge ${cfg.cls}`}>
            <StatusIcon size={16} />
            <span>{cfg.label}</span>
          </div>

          <div className="doc-result-header">
            <FileText size={16} />
            <span>{result.document_type || "Document"}</span>
            <span className="doc-filename">{result.filename}</span>
          </div>

          <div className="doc-fields">
            {result.holder_name && (
              <div className="doc-field">
                <span className="doc-field-label">Holder</span>
                <span>{result.holder_name}</span>
              </div>
            )}
            {result.document_number && (
              <div className="doc-field">
                <span className="doc-field-label">Number</span>
                <span>{result.document_number}</span>
              </div>
            )}
            {result.issuing_authority && (
              <div className="doc-field">
                <span className="doc-field-label">Issued by</span>
                <span>{result.issuing_authority}</span>
              </div>
            )}
            {result.issue_date && (
              <div className="doc-field">
                <span className="doc-field-label">Issue Date</span>
                <span>{result.issue_date}</span>
              </div>
            )}
            {result.expiry_date && (
              <div className="doc-field">
                <span className="doc-field-label">Expiry Date</span>
                <span className={result.status === "EXPIRED" ? "text-danger" : result.status === "EXPIRING_SOON" ? "text-warning" : ""}>
                  {result.expiry_date}
                </span>
              </div>
            )}
          </div>

          {result.validity_notes && (
            <div className="doc-notes">{result.validity_notes}</div>
          )}

          {result.warnings.length > 0 && (
            <div className="doc-warnings">
              {result.warnings.map((w, i) => (
                <div key={i} className="doc-warning-item">
                  <AlertTriangle size={13} /> {w}
                </div>
              ))}
            </div>
          )}

          <button className="doc-validate-another" onClick={() => { setResult(null); setError(""); }}>
            Validate Another Document
          </button>
        </div>
      )}
    </div>
  );
}
