import { useId } from "react";

/** lavaquant mark: a Q whose counter holds a rising line. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`lg-${id}`} x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffa35e" />
          <stop offset="0.5" stopColor="#ff6a3d" />
          <stop offset="1" stopColor="#ff3d6e" />
        </linearGradient>
        <radialGradient id={`gl-${id}`} cx="0.3" cy="0.15" r="0.9">
          <stop stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#lg-${id})`} />
      <rect width="32" height="32" rx="9" fill={`url(#gl-${id})`} />
      <circle cx="15" cy="15" r="7.6" stroke="#fff" strokeWidth="2.2" />
      <path d="M10.6 17.4l3-3.2 2.4 1.9 3.3-4.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.6 20.6L25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
