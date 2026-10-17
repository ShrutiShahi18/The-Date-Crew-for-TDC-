import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
export default function Home({ user }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/api/home').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p role="alert" className="text-brand">{err}</p>;
  if (!d) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-10">
      <div><h1 className="text-4xl">Welcome back, {user.displayName}</h1>
        <p className="text-muted">{d.customers} customers assigned · {d.awaiting} introductions awaiting a response</p>
        <div className="mt-4 flex gap-2"><Link className="btn btn-primary" to="/customers">View customers</Link><Link className="btn" to="/customers">Discover matches</Link></div></div>
      <section><h2 className="text-2xl">Needs your attention</h2>
        {d.followUps.length === 0 ? <p className="card mt-2 text-muted">No follow-ups due in the next 7 days.</p> :
          <ul className="mt-2 space-y-2">{d.followUps.map((f) => <li key={f.id}><Link to={`/customers/${f.customerId}`} className="card block text-sm hover:border-brand"><b>{f.customer}</b>: {f.text}<div className="text-xs text-muted">Due {new Date(f.due).toLocaleDateString()}</div></Link></li>)}</ul>}</section>
      <section><h2 className="text-2xl">Recent introductions</h2>
        {d.recent.length === 0 ? <p className="card mt-2 text-muted">None sent yet. Open a customer to review suggestions.</p> :
          <ul className="mt-2 space-y-2">{d.recent.map((i) => <li key={i.id}><Link to={`/customers/${i.customerId}`} className="card block text-sm hover:border-brand">{i.customer} introduced to {i.candidate} · <b>{i.status}</b> · {new Date(i.at).toLocaleDateString()}</Link></li>)}</ul>}</section>
      <section><h2 className="text-2xl">Recently updated profiles</h2>
        <ul className="mt-2 space-y-2">{d.updated.map((p) => <li key={p.id}><Link to={`/customers/${p.id}`} className="card block text-sm hover:border-brand">{p.name} · {p.status}</Link></li>)}</ul></section>
    </div>
  );
}
