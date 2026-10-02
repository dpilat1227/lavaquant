/**
 * WorldQuant BRAIN expression compatibility checker.
 * Flags fields that exist in our local DSL but not in WQ's FastExpr dataset.
 */

interface FieldWarning {
  field: string;
  suggestion: string;
}

// Fields available locally but not (or differently named) in WQ's dataset
const INCOMPATIBLE: Record<string, string> = {
  volume_ratio: "adv20 — use volume / adv20 for a volume ratio",
  log_returns:  "log_ret",
  gap:          "open / ts_delay(close, 1) - 1",
  range:        "high - low  (or (high - low) / close for %)",
};

export function checkWQCompat(expression: string): FieldWarning[] {
  const warnings: FieldWarning[] = [];
  for (const [field, suggestion] of Object.entries(INCOMPATIBLE)) {
    // Word-boundary match so "close" doesn't trigger on "log_returns"
    const re = new RegExp(`\\b${field}\\b`);
    if (re.test(expression)) {
      warnings.push({ field, suggestion });
    }
  }
  return warnings;
}
