"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type RowAction = {
  label: string;
  onSelect: () => void;
  /** Renders in red — for anything you can't casually undo. */
  danger?: boolean;
  icon?: React.ReactNode;
};

/**
 * The three-dot menu on a table row.
 *
 * Row actions add up fast, and a row of four buttons is both ugly and
 * easy to mis-tap on a phone. This keeps one small target and puts the
 * choice in a list where each item is a full-width tap.
 *
 * Closes on outside click, on Escape, on scroll, and after any choice.
 *
 * The panel is portalled to the body and positioned from the button's
 * screen rect. It has to be: the table sits in a horizontally
 * scrollable wrapper, and a normal absolute-positioned panel inside
 * that wrapper gets clipped — the menu opens and you see nothing.
 */
export default function RowMenu({
  actions,
  label = "Row actions",
}: {
  actions: RowAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = box.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Scrolling would leave the panel floating away from its row.
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

  return (
    <div ref={box} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="btn btn-ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        style={{ padding: "2px 6px" }}
      >
        <MoreVertical size={16} />
      </button>

      {open && at && createPortal(
        <div
          ref={panel}
          role="menu"
          style={{
            position: "fixed",
            top: at.top,
            right: at.right,
            zIndex: 80,
            minWidth: 176,
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
            boxShadow: "0 6px 20px rgba(0,0,0,.12)",
            padding: 4,
            textAlign: "left",
          }}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                justifyContent: "flex-start",
                padding: "7px 10px",
                fontSize: 13,
                color: a.danger ? "#b3261e" : undefined,
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
