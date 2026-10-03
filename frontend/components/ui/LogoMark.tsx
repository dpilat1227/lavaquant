/** LavaQuant mark: the Lava flame with a rising signal inside it. Flat orange on dark, same family as the other Lava projects. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#121214" stroke="#ff7a1a" strokeOpacity="0.4" />
      <path d="M19.4 4.6C19.2 9.4 24.2 12.2 24.2 19.2A8.2 8.2 0 0 1 7.8 19.2C7.8 15.6 9.8 13.2 11.6 11.4C11.9 13.4 12.8 14.6 14 15C13.2 11.8 15.2 7.4 19.4 4.6Z" stroke="#ff7a1a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 23l3-3.2 2.2 1.8 3-4.2" stroke="#ffb36b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
