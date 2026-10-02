import { ImageResponse } from "next/og";

export const alt = "lavaquant: quantitative alpha research platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Decorative equity-style curve, deterministic
function curve(): string {
  const pts: string[] = [];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 1200;
    const y = 520 - i * 3.3 + Math.sin(i * 0.5) * 18 + Math.sin(i * 1.6) * 8 + (i > 40 && i < 56 ? (i - 40) * 2.2 * ((56 - i) / 16) : 0);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export default function OpenGraphImage() {
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
          padding: "64px 72px",
          backgroundColor: "#09090b",
          backgroundImage: "radial-gradient(circle at 85% 0%, rgba(255,106,61,0.32), rgba(255,106,61,0) 55%), radial-gradient(circle at 0% 100%, rgba(255,61,129,0.22), rgba(255,61,129,0) 55%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0, opacity: 0.5 }}>
          <defs>
            <linearGradient id="s" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ffb36b" stopOpacity="0.15" />
              <stop offset="55%" stopColor="#ff6a3d" />
              <stop offset="100%" stopColor="#ff3d81" />
            </linearGradient>
            <linearGradient id="f" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ff6a3d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L1200 630 L0 630 Z`} fill="url(#f)" />
          <path d={line} fill="none" stroke="url(#s)" strokeWidth="5" strokeLinecap="round" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #ffa35e, #ff6a3d 50%, #ff3d6e)",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <circle cx="15" cy="15" r="7.6" stroke="#fff" strokeWidth="2.2" />
              <path d="M10.6 17.4l3-3.2 2.4 1.9 3.3-4.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.6 20.6L25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>lavaquant</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 900 }}>
            Research alphas the way quants do.
          </div>
          <div style={{ fontSize: 28, color: "#a1a1aa", maxWidth: 860 }}>
            Write in the WorldQuant DSL, backtest in seconds, benchmark against BRAIN and Numerai.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 22, color: "#76767f" }}>
            <span>Drew Pilat</span>
            <span>·</span>
            <span>MS Computer Science, University of Chicago</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
