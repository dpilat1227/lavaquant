import { ImageResponse } from "next/og";

export const alt = "LavaQuant: quantitative alpha research platform";
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
          <svg width="72" height="72" viewBox="0 0 32 32" fill="none">
            <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#121214" stroke="#ff7a1a" strokeOpacity="0.4" />
            <path d="M19.4 4.6C19.2 9.4 24.2 12.2 24.2 19.2A8.2 8.2 0 0 1 7.8 19.2C7.8 15.6 9.8 13.2 11.6 11.4C11.9 13.4 12.8 14.6 14 15C13.2 11.8 15.2 7.4 19.4 4.6Z" stroke="#ff7a1a" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 23l3-3.2 2.2 1.8 3-4.2" stroke="#ffb36b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>LavaQuant</div>
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
