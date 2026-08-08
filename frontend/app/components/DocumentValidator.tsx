"use client";
import { useRef, useState } from "react";
import { ShieldCheck, Upload, AlertTriangle, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { API_URL } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";

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

type DocValidatorKey = keyof (typeof translations)["en"]["docValidator"];

const STATUS_CONFIG: Record<ValidationResult["status"], { icon: typeof CheckCircle; labelKey: DocValidatorKey; cls: string }> = {
  VALID: { icon: CheckCircle, labelKey: "statusValid", cls: "doc-status-valid" },
  EXPIRING_SOON: { icon: Clock, labelKey: "statusExpiringSoon", cls: "doc-status-warning" },
  EXPIRED: { icon: XCircle, labelKey: "statusExpired", cls: "doc-status-expired" },
  CANNOT_DETERMINE: { icon: AlertTriangle, labelKey: "statusCannotDetermine", cls: "doc-status-unknown" },
};

export default function DocumentValidator({ token }: { token: string }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  async function validate(file: File) {
    setLoading(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/documents/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("docValidator", "validationFailed"));
      setResult(data);
    } catch (e: any) {
      setError(e.message || t("docValidator", "validationFailedRetry"));
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
        <span>{t("docValidator", "heading")}</span>
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
            <span>{t("docValidator", "analyzingStatus")}</span>
          </div>
        ) : (
          <>
            <Upload size={28} className="doc-drop-icon" />
            <div className="doc-drop-title">{t("docValidator", "dropTitle")}</div>
            <div className="doc-drop-sub">{t("docValidator", "dropSub")}</div>
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
            <span>{t("docValidator", cfg.labelKey)}</span>
          </div>

          <div className="doc-result-header">
            <FileText size={16} />
            <span>{result.document_type || t("docValidator", "documentFallback")}</span>
            <span className="doc-filename">{result.filename}</span>
          </div>

          <div className="doc-fields">
            {result.holder_name && (
              <div className="doc-field">
                <span className="doc-field-label">{t("docValidator", "holderLabel")}</span>
                <span>{result.holder_name}</span>
              </div>
            )}
            {result.document_number && (
              <div className="doc-field">
                <span className="doc-field-label">{t("docValidator", "numberLabel")}</span>
                <span>{result.document_number}</span>
              </div>
            )}
            {result.issuing_authority && (
              <div className="doc-field">
                <span className="doc-field-label">{t("docValidator", "issuedByLabel")}</span>
                <span>{result.issuing_authority}</span>
              </div>
            )}
            {result.issue_date && (
              <div className="doc-field">
                <span className="doc-field-label">{t("docValidator", "issueDateLabel")}</span>
                <span>{result.issue_date}</span>
              </div>
            )}
            {result.expiry_date && (
              <div className="doc-field">
                <span className="doc-field-label">{t("docValidator", "expiryDateLabel")}</span>
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
            {t("docValidator", "validateAnother")}
          </button>
        </div>
      )}
    </div>
  );
}
