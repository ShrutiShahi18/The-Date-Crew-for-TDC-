import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import ScoreRing from '../components/ScoreRing';
const show = (v) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? <span className="text-muted">Not stated</span> : Array.isArray(v) ? v.join(', ') : String(v));
const LABEL = { met: 'Meets the stated preference', missed: 'Differs from the stated preference; worth discussing', unknown: 'Cannot check: information missing' };
const Prefs = ({ title, items }) => (
  <div className="card"><h3 className="text-xl">{title}</h3>
    {items.length === 0 ? <p className="mt-1 text-sm text-muted">No preferences stated.</p> : <ul className="mt-2 space-y-1 text-sm">{items.map((c) => <li key={c.key}><b>{c.label}</b>: <span className={c.status === 'missed' ? 'text-gold' : c.status === 'unknown' ? 'text-muted' : ''}>{LABEL[c.status]}</span></li>)}</ul>}</div>
);
export default function Compare() {
  const { id, cid } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api(`/api/customers/${id}/matches/${cid}/compare`).then(setD).catch((e) => setErr(e.message)); }, [id, cid]);
  if (err) return <p role="alert" className="text-brand">{err}</p>;
  if (!d) return <p className="text-muted">Loading…</p>;
  const r = d.result;
  return (
    <div className="space-y-8">
      <Link to={`/customers/${id}`} className="inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft size={14} /> Back to {d.customer}</Link>
      <div className="flex items-end justify-between"><h1 className="text-4xl">{d.customer} and {d.candidate}</h1>
        <div className="flex flex-col items-center"><ScoreRing value={r.score} size={96} /><div className="mt-1 max-w-[12rem] text-center text-xs text-muted">Compatibility from stated details, based on {r.confidence}% of the information</div></div></div>
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Profile comparison</caption>
        <thead><tr className="text-xs uppercase text-muted"><th scope="col" className="pb-2">Topic</th><th scope="col">{d.customer}</th><th scope="col">{d.candidate}</th></tr></thead>
        <tbody>{d.rows.map(([k, a, b]) => <tr key={k} className="border-t border-line"><th scope="row" className="py-2 pr-3 font-normal text-muted">{k}</th><td className="pr-3">{show(a)}</td><td>{show(b)}</td></tr>)}</tbody></table></div>
      <div className="grid gap-4 md:grid-cols-2"><Prefs title={`${d.customer}'s preferences, applied to ${d.candidate}`} items={d.customerPrefsOnCandidate} /><Prefs title={`${d.candidate}'s preferences, applied to ${d.customer}`} items={d.candidatePrefsOnCustomer} /></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[['Aligned', r.highlights], ['Worth discussing', r.differences], ['Not yet known', r.missing]].map(([t, l]) => <div key={t} className="card"><h3 className="text-xl">{t}</h3>{l.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{l.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-1 text-sm text-muted">Nothing to note.</p>}</div>)}</div>
      <div className="card"><h3 className="text-xl">Conversation starters</h3>{d.starters.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{d.starters.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="mt-1 text-sm text-muted">No shared interests, city or intention are stated yet, so there is nothing grounded to suggest.</p>}<p className="mt-2 text-xs text-muted">Built only from details both profiles state. You can edit them when you write the introduction.</p></div>
      <p className="text-xs text-muted">Unknown values are never treated as mismatches. Income, caste, religion and contact details are not shown here.</p>
    </div>
  );
}
