import { useEffect, useState } from 'react';
// A ring plus a "%" and the word "match" so the figure reads as a compatibility percentage, not a rank or index.
export default function ScoreRing({ value, size = 72 }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setV(value)); return () => cancelAnimationFrame(t); }, [value]);
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value} percent compatibility`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-serif text-ink" style={{ fontSize: size * 0.3 }}>{value}<span style={{ fontSize: size * 0.18 }}>%</span></span>
        <span className="mt-0.5 uppercase tracking-wide text-muted" style={{ fontSize: Math.max(8, size * 0.12) }}>match</span>
      </div>
    </div>
  );
}
