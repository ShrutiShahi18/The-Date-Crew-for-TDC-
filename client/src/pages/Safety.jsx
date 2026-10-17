import { useEffect, useState } from 'react';
import { api } from '../api';
const CATS = ['Harassment or threats', 'Impersonation', 'Fraud or scams', 'Unwanted sexual behaviour', 'Repeated boundary violations', 'Other policy concern'];
const ACTIONS = ['Warning', 'Temporary restriction', 'Suspension', 'Permanent ban'];
function Picker({ onPick, picked, initial = '' }) {
  const [q, setQ] = useState(initial); const [rs, setRs] = useState([]);
  useEffect(() => { if (q.length < 2) return setRs([]); const t = setTimeout(() => api(`/api/safety/profiles?q=${encodeURIComponent(q)}`).then((d) => setRs(d.data)).catch(() => {}), 250); return () => clearTimeout(t); }, [q]);
  return (<div><input className="input" aria-label="Search profile by first name" placeholder={picked ? `Selected: ${picked.name}` : 'Search profile by first name'} value={q} onChange={(e) => setQ(e.target.value)} />
    {rs.map((p) => <button key={p.id} type="button" className="btn mr-2 mt-2" onClick={() => { onPick(p); setQ(''); setRs([]); }}>{p.name} · {p.city} · {p.role}{p.status !== 'active' ? ` · ${p.status}` : ''}</button>)}</div>);
}
function ReportRow({ r, onDone }) {
  const [note, setNote] = useState(''); const [action, setAction] = useState(ACTIONS[0]); const [err, setErr] = useState('');
  const go = async (status, extra = {}) => { setErr(''); try { await api(`/api/safety/reports/${r._id}`, { method: 'PATCH', body: { status, note, ...extra } }); setNote(''); onDone(); } catch (e) { setErr(e.message); } };
  const s = r.status;
  return (
    <li className="card text-sm"><div className="flex justify-between"><b>{r.subject}</b><span className="rounded-full border border-gold px-3 py-0.5 text-xs">{s}{r.decision ? ` · ${r.decision}` : ''}</span></div>
      <div className="text-muted">{r.category}</div><p className="mt-1">{r.description}</p>
      <p className="mt-1 text-xs text-muted">Unverified allegation until reviewed. History: {r.history.map((h) => `${h.status} (${new Date(h.at).toLocaleDateString()})`).join(' → ')}</p>
      {s !== 'Resolved' && <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" aria-label="Review note" placeholder="Review note (required)" value={note} onChange={(e) => setNote(e.target.value)} />
        {s === 'Submitted' && <button className="btn" onClick={() => go('Under review')}>Start review</button>}
        {s === 'Under review' && <><select className="input w-auto" aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
          <button className="btn btn-primary" onClick={() => go('Action taken', { action })}>Take action</button><button className="btn" onClick={() => go('No violation found')}>No violation found</button></>}
        {(s === 'Action taken' || s === 'No violation found') && <><button className="btn" onClick={() => go('Appealed')}>Record appeal</button><button className="btn" onClick={() => go('Resolved')}>Resolve</button></>}
        {s === 'Appealed' && <><button className="btn" onClick={() => go('Under review')}>Re-open review</button><button className="btn" onClick={() => go('Resolved', { reinstate: true })}>Resolve and reinstate</button><button className="btn" onClick={() => go('Resolved')}>Resolve</button></>}
      </div>}
      {err && <p role="alert" className="mt-2 text-brand">{err}</p>}</li>
  );
}
export default function Safety() {
  const [reports, setReports] = useState(null); const [subj, setSubj] = useState(null); const [f, setF] = useState({ category: CATS[0], description: '' }); const [msg, setMsg] = useState('');
  const [vp, setVp] = useState(null); const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [vmsg, setVmsg] = useState('');
  const load = () => api('/api/safety/reports').then((d) => setReports(d.data)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  async function file(e) { e.preventDefault(); setMsg(''); try { await api('/api/safety/reports', { method: 'POST', body: { subjectId: subj.id, ...f } }); setF({ ...f, description: '' }); setSubj(null); setMsg('Report submitted for review.'); load(); } catch (x) { setMsg(x.message); } }
  async function vcall(path, body) { setVmsg(''); try { const d = await api(`/api/safety/verify/${path}`, { method: 'POST', body }); setVmsg(d.mockOtp ? `Mock OTP: ${d.mockOtp}. ${d.note}` : d.note); } catch (x) { setVmsg(x.message); } }
  return (
    <div className="space-y-8"><div><h1 className="text-4xl">Trust &amp; Safety</h1>
      <p className="text-muted">Reports are allegations until reviewed. Ghosting is not a violation, and safety decisions never affect compatibility scores.</p></div>
      <div className="card text-sm"><h2 className="font-serif text-xl">How safety works here</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5"><li>A report is a concern raised, not a finding. A person reviews it and records a reason for every decision.</li><li>Responses are proportionate: from a warning up to a ban for serious or repeated harm. Ghosting alone is never grounds for action.</li><li>Anyone affected can appeal, and a profile can be reinstated after review.</li><li>Introductions never share phone, email, income or family details. Safety decisions never change compatibility scores.</li></ul></div>
      <form onSubmit={file} className="card space-y-4"><h2 className="text-2xl">File a report</h2>
        <Picker onPick={setSubj} picked={subj} initial={new URLSearchParams(window.location.search).get('q') || ''} />
        <select className="input" aria-label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <textarea className="input h-24" aria-label="Description" placeholder="What happened? Stick to specific behaviour (min 10 characters)." value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />
        <button className="btn btn-primary" disabled={!subj}>Submit report</button>{msg && <p role="status" className="text-sm">{msg}</p>}</form>
      <section><h2 className="text-2xl">Reports</h2>
        {!reports ? <p className="text-muted">Loading…</p> : reports.length === 0 ? <p className="card mt-2 text-muted">No reports yet.</p> : <ul className="mt-2 space-y-3">{reports.map((r) => <ReportRow key={r._id} r={r} onDone={load} />)}</ul>}</section>
      <section className="card space-y-4"><h2 className="text-2xl">Mock phone verification</h2>
        <p className="text-sm text-muted">Prototype only: no SMS is sent, nothing is checked with a telecom, and numbers are stored as hashes. A number tied to an active ban cannot be reused for a new verified profile.</p>
        <Picker onPick={setVp} picked={vp} /><input className="input" aria-label="Phone number" placeholder="Synthetic phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex gap-2"><button className="btn" disabled={!vp || !phone} onClick={() => vcall('start', { profileId: vp.id, phone })}>Send mock OTP</button>
          <input className="input max-w-[9rem]" aria-label="OTP" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} /><button className="btn" disabled={!vp || otp.length !== 6} onClick={() => vcall('confirm', { profileId: vp.id, otp })}>Confirm</button></div>
        {vmsg && <p role="status" className="text-sm">{vmsg}</p>}</section>
    </div>
  );
}
