import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const CARD_SIZE = { width: 1200, height: 630 };

export interface CardCopy {
  /** Use \n to choose where a text headline breaks. */
  headline: string;
  /** Draw the headline as a line of code, coloured like the editor. */
  code?: boolean;
  subline: string;
  byline: string;
}

// The editor's own colours (lib/dsl.ts), so the card shows the product's look.
const TOKEN_COLOR = {
  fn: "#ffb36b",
  field: "#5eead4",
  number: "#ff8049",
  operator: "#a1a1aa",
  paren: "#8d8d97",
  comma: "#8d8d97",
} as const;

type Token = { text: string; color: string };

function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)(\()?|(\d+(?:\.\d+)?)|([(),])|(-)|(\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (m[1]) {
      out.push({ text: m[1], color: m[2] ? TOKEN_COLOR.fn : TOKEN_COLOR.field });
      if (m[2]) out.push({ text: "(", color: TOKEN_COLOR.paren });
    } else if (m[3]) out.push({ text: m[3], color: TOKEN_COLOR.number });
    else if (m[4]) out.push({ text: m[4], color: m[4] === "," ? TOKEN_COLOR.comma : TOKEN_COLOR.paren });
    else if (m[5]) out.push({ text: "-", color: TOKEN_COLOR.operator });
    else if (m[6]) out.push({ text: " ", color: TOKEN_COLOR.operator });
  }
  return out;
}

// Decorative equity-style curve, deterministic. It sits low and quiet so the words stay readable.
function curve(): string {
  const pts: string[] = [];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 1200;
    const y = 650 - i * 2.2 + Math.sin(i * 0.5) * 14 + Math.sin(i * 1.6) * 6 + (i > 40 && i < 56 ? (i - 40) * 1.6 * ((56 - i) / 16) : 0);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

// The site's own fonts (Geist), as static cuts of the variable files in app/fonts: the card renderer can't read
// variable fonts. Read from disk; the route is built once, at deploy time.
export async function loadCardFonts() {
  const read = (file: string) => readFile(join(process.cwd(), "app/fonts/card", file));
  const [sans, sansBold, mono] = await Promise.all([
    read("Geist-Regular.ttf"),
    read("Geist-SemiBold.ttf"),
    read("GeistMono-Medium.ttf"),
  ]);
  return { sans, sansBold, mono };
}

type CardFonts = Awaited<ReturnType<typeof loadCardFonts>>;

export function renderCard(copy: CardCopy, fonts: CardFonts) {
  const line = curve();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px 96px",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 85% 0%, rgba(255,106,61,0.30), rgba(255,106,61,0) 55%), radial-gradient(circle at 0% 100%, rgba(255,61,129,0.20), rgba(255,61,129,0) 55%)",
          color: "#f4f4f5",
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0, opacity: 0.4 }}>
          <defs>
            <linearGradient id="s" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ffb36b" stopOpacity="0.1" />
              <stop offset="55%" stopColor="#ff6a3d" />
              <stop offset="100%" stopColor="#ff3d81" />
            </linearGradient>
            <linearGradient id="f" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ff6a3d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L1200 630 L0 630 Z`} fill="url(#f)" />
          <path d={line} fill="none" stroke="url(#s)" strokeWidth="5" strokeLinecap="round" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="72" viewBox="0 0 32 32" fill="none">
              <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#121214" stroke="#ff7a1a" strokeOpacity="0.4" />
              <path d="M19.4 4.6C19.2 9.4 24.2 12.2 24.2 19.2A8.2 8.2 0 0 1 7.8 19.2C7.8 15.6 9.8 13.2 11.6 11.4C11.9 13.4 12.8 14.6 14 15C13.2 11.8 15.2 7.4 19.4 4.6Z" stroke="#ff7a1a" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 23l3-3.2 2.2 1.8 3-4.2" stroke="#ffb36b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>LavaQuant</div>
          </div>
          <div style={{ fontSize: 30, color: "#c8c8cf" }}>{copy.byline}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          {copy.code ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                padding: "30px 44px",
                borderRadius: 24,
                border: "1.5px solid rgba(255,255,255,0.14)",
                backgroundColor: "rgba(18,18,20,0.88)",
                fontFamily: "Geist Mono",
                fontSize: 62,
              }}
            >
              {tokenize(copy.headline).map((t, i) => (
                <span key={i} style={{ color: t.color, whiteSpace: "pre" }}>
                  {t.text}
                </span>
              ))}
              <div style={{ width: 8, height: 72, marginLeft: 8, borderRadius: 3, backgroundColor: "#ff6a3d" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", fontSize: 82, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.5 }}>
              {copy.headline.split("\n").map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 42, lineHeight: 1.25, color: "#e4e4e7", maxWidth: 1056 }}>{copy.subline}</div>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts: [
        { name: "Geist", data: fonts.sans, weight: 400, style: "normal" },
        { name: "Geist", data: fonts.sansBold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: fonts.mono, weight: 500, style: "normal" },
      ],
    }
  );
}
