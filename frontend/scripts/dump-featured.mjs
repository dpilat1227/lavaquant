// Prints the sample result (lib/featuredAlpha.ts) as JSON so the backend can compute its risk block.
//
//   node scripts/dump-featured.mjs | ../backend/.venv/bin/python ../backend/scripts/backfill_risk.py --stdin > lib/featuredRisk.json
//
// Re-run both steps whenever the generator in lib/featuredAlpha.ts changes.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib", "featuredAlpha.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});

const dir = mkdtempSync(join(tmpdir(), "featured-"));
const file = join(dir, "featuredAlpha.mjs");
writeFileSync(file, outputText);
const { FEATURED_ALPHA } = await import(pathToFileURL(file).href);
process.stdout.write(JSON.stringify({ daily_pnl: FEATURED_ALPHA.daily_pnl, equity_curve: FEATURED_ALPHA.equity_curve }));
