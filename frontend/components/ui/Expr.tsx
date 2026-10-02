import { DSL_FUNCTIONS, DSL_FIELDS } from "@/lib/dsl";

const FN = new Set(DSL_FUNCTIONS.map((f) => f.name));
const FIELD = new Set(DSL_FIELDS.map((f) => f.name));
const GROUP = new Set(["sector", "industry", "subindustry"]);

/** Syntax-colored alpha expression, matching the editor theme. */
export function Expr({ code, className = "" }: { code: string; className?: string }) {
  const tokens = code.split(/([A-Za-z_]\w*|\d+(?:\.\d+)?)/g);
  return (
    <code className={`font-mono ${className}`}>
      {tokens.map((t, i) => {
        if (!t) return null;
        if (/^\d/.test(t)) return <span key={i} className="text-lava-400">{t}</span>;
        if (/^[A-Za-z_]/.test(t)) {
          const rest = tokens.slice(i + 1).join("");
          const isCall = /^\s*\(/.test(rest);
          if (isCall && FN.has(t)) return <span key={i} className="font-semibold text-[#ffb36b]">{t}</span>;
          if (GROUP.has(t)) return <span key={i} className="text-[#c4a7ff]">{t}</span>;
          if (FIELD.has(t)) return <span key={i} className="text-[#5eead4]">{t}</span>;
          return <span key={i} className="text-down">{t}</span>;
        }
        return <span key={i} className="text-gray-500">{t}</span>;
      })}
    </code>
  );
}
