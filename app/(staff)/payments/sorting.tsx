"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { headCell } from "./sheet";
import type { PaymentRow } from "@/lib/payments";

export type SortKey =
  | "date"
  | "pmName"
  | "projectName"
  | "payTo"
  | "reason"
  | "amount";

export type Sort = { key: SortKey; dir: "asc" | "desc" };

/**
 * Sorting with a stable tail: rows that tie on the chosen column always
 * come back in the same order, so clicking a header twice doesn't shuffle
 * unrelated rows around.
 */
function compareRows(a: PaymentRow, b: PaymentRow, key: SortKey): number {
  const primary =
    key === "amount"
      ? a.amount - b.amount
      : String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "en", {
          numeric: true,
          sensitivity: "base",
        });
  if (primary !== 0) return primary;
  return (
    a.date.localeCompare(b.date) ||
    a.pmName.localeCompare(b.pmName) ||
    a.reason.localeCompare(b.reason)
  );
}

export function sortRows(rows: PaymentRow[], sort: Sort): PaymentRow[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => factor * compareRows(a, b, sort.key));
}

/** Clicking the active column flips it; a new column starts fresh. */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  // Money reads biggest-first; everything else reads A to Z.
  return { key, dir: key === "amount" ? "desc" : "asc" };
}

export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  width,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  width?: number;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th
      style={{
        ...headCell,
        textAlign: align,
        width,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      title={`Sort by ${label}`}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        {label}
        <Icon size={11} style={{ opacity: active ? 0.9 : 0.3 }} />
      </span>
    </th>
  );
}
