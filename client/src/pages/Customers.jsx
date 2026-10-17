import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
export const Avatar = ({ p, size = 44 }) => (
  <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-t-full rounded-b-lg border border-gold bg-bg font-serif text-brand">{(p.firstName?.[0] || '') + (p.lastName?.[0] || '')}</span>
);
const STATUSES = ['Ready for matching', 'Introduction sent', 'On hold', 'Profile incomplete', 'New'];
export default function Customers() {
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const [res, setRes] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    setRes(null); setErr('');
    const t = setTimeout(() => api(`/api/customers?page=${page}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`).then(setRes).catch((e) => setErr(e.message)), 250);
    return () => clearTimeout(t);
  }, [q, status, page]);
  return (
    <section>
      <h1 className="text-4xl">Your customers</h1>
      <p className="mb-6 text-muted">People assigned to you. Open a profile to find and send introductions.</p>
      <div className="mb-6 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search by name" aria-label="Search by name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input max-w-xs" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {err && <p role="alert" className="text-brand">{err}</p>}
      {!res && !err && <p className="text-muted">Loading…</p>}
      {res && res.data.length === 0 && <div className="card text-muted">No customers match these filters.</div>}
      <ul className="space-y-4">
        {res?.data.map((c) => (
          <li key={c._id}><Link to={`/customers/${c._id}`} className="card lift flex items-center gap-4 hover:border-brand">
            <Avatar p={c} /><div className="flex-1"><div className="font-serif text-xl">{c.firstName} {c.lastName}</div>
            <div className="text-sm text-muted">{c.age} · {c.city} · {c.maritalStatus}</div></div>
            <span className="rounded-full border border-gold px-3 py-1 text-xs">{c.journeyStatus}</span></Link></li>
        ))}
      </ul>
      {res && res.total > 20 && (
        <div className="mt-4 flex gap-2"><button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn" disabled={page * 20 >= res.total} onClick={() => setPage(page + 1)}>Next</button></div>
      )}
    </section>
  );
}
