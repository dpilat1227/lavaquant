import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(
  value: number,
  kind: "percent" | "decimal" | "int" | "pct4" = "decimal",
  decimals = 2
): string {
  if (!isFinite(value)) return "—";
  switch (kind) {
    case "percent":
      return `${(value * 100).toFixed(decimals)}%`;
    case "pct4":
      return `${(value * 100).toFixed(4)}%`;
    case "int":
      return Math.round(value).toLocaleString();
    default:
      return value.toFixed(decimals);
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] = acc[k] ?? []).push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}
