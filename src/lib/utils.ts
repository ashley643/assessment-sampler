import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Column, ColumnType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Column type inference ─────────────────────────────────────────────────

export function inferColumnType(values: (string | number | null)[]): ColumnType {
  const nonNull = values.filter((v) => v !== null && v !== "");
  if (nonNull.length === 0) return "string";

  const sample = nonNull.slice(0, 20);

  // Percent
  if (sample.every((v) => typeof v === "string" && /^\d+(\.\d+)?%$/.test(v as string))) {
    return "percent";
  }

  // Number
  if (sample.every((v) => !isNaN(Number(v)))) {
    return "number";
  }

  // Date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    /^\d{4}$/,
    /^Q[1-4]\s+\d{4}$/,
  ];
  if (sample.every((v) => datePatterns.some((p) => p.test(String(v))))) {
    return "date";
  }

  // Boolean
  const boolValues = new Set(["true", "false", "yes", "no", "1", "0"]);
  if (sample.every((v) => boolValues.has(String(v).toLowerCase()))) {
    return "boolean";
  }

  return "string";
}

export function inferColumns(rows: Record<string, string | number | null>[]): Column[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const values = rows.map((r) => r[key]);
    return {
      key,
      label: key
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      type: inferColumnType(values),
    };
  });
}

// ─── Color palettes ──────────────────────────────────────────────────────────

export const CHART_COLORS = [
  "#6366f1", // indigo
  "#22d3ee", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#06b6d4", // sky
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
];

export const REPORT_THEMES = [
  {
    name: "Impacter",
    primaryColor: "#6366f1",
    secondaryColor: "#22d3ee",
    accentColor: "#f59e0b",
    fontFamily: "Inter, sans-serif",
  },
  {
    name: "Forest",
    primaryColor: "#059669",
    secondaryColor: "#10b981",
    accentColor: "#d97706",
    fontFamily: "Georgia, serif",
  },
  {
    name: "Ocean",
    primaryColor: "#0284c7",
    secondaryColor: "#06b6d4",
    accentColor: "#7c3aed",
    fontFamily: "Inter, sans-serif",
  },
  {
    name: "Slate",
    primaryColor: "#475569",
    secondaryColor: "#64748b",
    accentColor: "#f43f5e",
    fontFamily: "Inter, sans-serif",
  },
];

// ─── Number formatting ────────────────────────────────────────────────────────

export function formatValue(value: number | string | null, type?: ColumnType): string {
  if (value === null || value === undefined) return "—";
  if (type === "percent") return `${value}`;
  if (type === "number" && typeof value === "number") {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return String(value);
}

// ─── ID generator ────────────────────────────────────────────────────────────

export function genId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Parse percent strings ────────────────────────────────────────────────────

export function parseNumber(v: string | number | null): number {
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const clean = String(v).replace(/%|,|\$/g, "").trim();
  return isNaN(Number(clean)) ? 0 : Number(clean);
}
