"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Filter } from "lucide-react";

export type FilterOption = { id: string; label: string };

/**
 * A filter button that opens a checkbox list.
 *
 * Replaces a row of one button per option: thirteen trades wrapped onto
 * two lines, pushed the table down the page, and could only ever filter
 * by one at a time. This holds one small control, filters by any
 * combination, and doesn't grow as options are added.
 *
 * The panel is portalled to the body so a scrollable or overflow-hidden
 * container can't clip it.
 */
export default function FilterMenu({
  label,
  title,
  options,
  selected,
  onChange,
}: {
  label: string;
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = box.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );

  return (
    <div ref={box} style={{ display: "inline-block" }}>
      <button
        className="btn btn-secondary"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        style={
          selected.length
            ? {
                borderColor: "var(--color-accent)",
                background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              }
            : undefined
        }
      >
        <Filter size={15} />
        {label}
        {selected.length > 0 && (
          <span
            style={{
              marginLeft: 2,
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              color: "var(--color-accent-700)",
            }}
          >
            {selected.length}
          </span>
        )}
      </button>

      {open &&
        at &&
        createPortal(
          <div
            ref={panel}
            style={{
              position: "fixed",
              top: at.top,
              left: at.left,
              zIndex: 80,
              width: 244,
              maxHeight: "min(60vh, 420px)",
              overflowY: "auto",
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              boxShadow: "0 8px 24px rgba(0,0,0,.14)",
              padding: "12px 4px 6px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
                padding: "0 12px 8px",
              }}
            >
              {title}
            </div>

            {options.map((o) => (
              <label
                key={o.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  className="chk"
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.label}
              </label>
            ))}

            {selected.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  marginTop: 6,
                  padding: "6px 8px 0",
                }}
              >
                <button className="btn btn-ghost" onClick={() => onChange([])}>
                  Clear {selected.length} filter{selected.length === 1 ? "" : "s"}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
