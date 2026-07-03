"use client";

interface MarkProps {
  size?: number;
  className?: string;
}

/** Beauvé circular B mark — white/ivory circle with serif B */
export function BeauveMark({ size = 36, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle — white/ivory */}
      <circle cx="50" cy="50" r="48" fill="#F5EDE8" />
      {/* Subtle border ring */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="#D4B8B0" strokeWidth="1" />
      {/* Serif B — deep rose/burgundy */}
      <text
        x="50" y="68"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="56"
        fontWeight="400"
        fill="#6B3040"
      >
        L
      </text>
    </svg>
  );
}

/** Compact horizontal logo — circle mark + wordmark */
export function BeauveFullLogo({ height = 40 }: { height?: number; light?: boolean; className?: string }) {
  const w = height * 4;
  return (
    <svg width={w} height={height} viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#F5EDE8" />
      <circle cx="20" cy="20" r="17" fill="none" stroke="#D4B8B0" strokeWidth="0.6" />
      <text x="20" y="27" textAnchor="middle" fontFamily="Georgia,serif" fontSize="20" fill="#6B3040">L</text>
      <text x="46" y="26" fontFamily="'Segoe UI',Arial,sans-serif" fontSize="15" fontWeight="700"
        letterSpacing="3" fill="#6B3040">LUMI</text>
    </svg>
  );
}
