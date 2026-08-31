"use client";

/**
 * A select that carries an id, not just its label — the house ModalField
 * only does string options, and the day has to save as a date.
 *
 * It sits in its own file because two dialogs want it now: the payment's
 * day and the method the money went out by are both "pick one of these,
 * or leave it alone".
 */
export default function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: "#b3261e" }}> *</span>}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: "#b3261e" } : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
