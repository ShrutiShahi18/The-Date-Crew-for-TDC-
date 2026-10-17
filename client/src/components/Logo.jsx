export default function Logo({ size = 30, light = false }) {
  const a = light ? '#ffffff' : 'var(--brand)', b = light ? '#e5cf9c' : 'var(--gold)';
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M5 29V15a11 11 0 0 1 22 0v14" stroke={a} strokeWidth="2" /><path d="M10 29V16a6 6 0 0 1 12 0v13" stroke={b} strokeWidth="1.5" /><circle cx="16" cy="12" r="1.6" fill={a} />
      </svg>
      <span className={`font-serif text-2xl leading-none tracking-wide ${light ? 'text-white' : 'text-brand'}`}>The Date Crew</span>
    </span>
  );
}
