"use client";

import { useEffect } from "react";

/**
 * House modal. Follows the project rules: centred (never scrolls the page),
 * z-70 backdrop, click-outside closes, Escape closes, body scroll locked.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 480,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        style={{ width: `min(${width}px, 100%)`, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dialog-title">{title}</div>
            {subtitle && (
              <div className="text-muted" style={{ fontSize: 13 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: "0 6px", fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, overflowY: "auto", minHeight: 0 }}>
          {children}
        </div>

        {footer && <div className="dialog-actions">{footer}</div>}
      </div>
    </div>
  );
}

/** Labelled input with the red * and inline error, used inside modals. */
export function ModalField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
  textarea,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  options?: readonly string[];
}) {
  const style = error ? { borderColor: "#b3261e" } : undefined;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: "#b3261e" }}> *</span>}
      </label>

      {options ? (
        <select
          id={id}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={style}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          id={id}
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={style}
        />
      ) : (
        <input
          id={id}
          className="input"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={style}
        />
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}
