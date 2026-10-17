import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

// Dismissible confirmation banner. Closes itself after a few seconds; announced politely to screen readers.
export default function Banner({ title, message, onClose, ms = 7000 }) {
  useEffect(() => { const t = setTimeout(onClose, ms); return () => clearTimeout(t); }, [onClose, ms]);
  return (
    <div role="status" aria-live="polite" className="rise fixed inset-x-0 top-4 z-30 mx-auto flex w-[min(92vw,34rem)] items-start gap-3 rounded-xl border border-gold bg-surface p-4 shadow-lg">
      <CheckCircle2 className="mt-0.5 shrink-0 text-gold" size={20} aria-hidden="true" />
      <div className="flex-1">
        <p className="font-serif text-lg leading-tight">{title}</p>
        {message && <p className="mt-1 text-sm text-muted">{message}</p>}
      </div>
      <button className="rounded p-1 text-muted hover:text-ink" onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button>
    </div>
  );
}