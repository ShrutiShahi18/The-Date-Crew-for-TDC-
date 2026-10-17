import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
const YN = ['Yes', 'No', 'Maybe'];
const F = [['firstName', 'First name', 'text'], ['lastName', 'Last name', 'text'], ['gender', 'Gender', 'select', ['Male', 'Female', 'Non-binary', 'Other']], ['dob', 'Date of birth', 'date'], ['country', 'Country', 'text'], ['city', 'City', 'text'], ['heightCm', 'Height (cm)', 'number'],
  ['email', 'Email (private)', 'email'], ['phone', 'Phone (private)', 'text'], ['college', 'Undergraduate college', 'text'], ['degree', 'Degree', 'text'], ['income', 'Income (LPA)', 'number'], ['company', 'Current company', 'text'], ['designation', 'Designation', 'text'],
  ['maritalStatus', 'Marital status', 'select', ['Never married', 'Divorced', 'Widowed']], ['languages', 'Languages (comma-separated)', 'list'], ['siblings', 'Siblings', 'number'], ['caste', 'Caste (private, never used for scoring)', 'text'], ['religion', 'Religion', 'text'],
  ['wantsChildren', 'Wants children', 'select', YN], ['openToRelocation', 'Open to relocation', 'select', YN], ['openToPets', 'Open to pets', 'select', YN], ['intention', 'Relationship intention', 'select', ['marriage', 'long-term', 'open']],
  ['interests', 'Interests (comma-separated)', 'list'], ['bio', 'Short bio', 'area'], ['familyExpectations', 'Family expectations', 'area'], ['values', 'Important values', 'area'], ['lifestyle', 'Lifestyle', 'area']];
const REQ = new Set(['firstName', 'lastName', 'gender', 'dob', 'country', 'city', 'maritalStatus', 'bio']);
const PN = [['ageMin', 'Partner age from'], ['ageMax', 'Partner age to'], ['heightMin', 'Partner height from (cm)'], ['incomeMin', 'Partner income from (LPA)']];
const HARD = [['age', 'Age'], ['height', 'Height'], ['income', 'Income'], ['city', 'City'], ['children', 'Children']];
const num = (s) => (s === '' || s == null ? null : Number(s));
export default function EditProfile() {
  const { id } = useParams(); const nav = useNavigate();
  const [v, setV] = useState(null); const [p, setP] = useState({}); const [hard, setHard] = useState([]); const [interest, setInterest] = useState([]); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/api/customers/${id}`).then(({ data: c }) => {
    setV(Object.fromEntries(F.map(([k, , kind]) => [k, kind === 'list' ? (c[k] || []).join(', ') : c[k] == null ? '' : String(c[k])])));
    const pr = c.prefs || {}; setP({ ageMin: pr.ageMin ?? '', ageMax: pr.ageMax ?? '', heightMin: pr.heightMin ?? '', incomeMin: pr.incomeMin ?? '', cities: (pr.cities || []).join(', ') }); setHard(pr.hard || []); setInterest(c.interestedIn || []);
  }).catch((e) => setErr({ message: e.message })); }, [id]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setErr(null); const body = {};
    for (const [k, , kind] of F) { const raw = v[k];
      body[k] = kind === 'list' ? raw.split(',').map((s) => s.trim()).filter(Boolean) : kind === 'number' ? num(raw) : REQ.has(k) ? raw : raw.trim() === '' ? null : raw.trim(); }
    body.prefs = { ageMin: num(p.ageMin), ageMax: num(p.ageMax), heightMin: num(p.heightMin), incomeMin: num(p.incomeMin), cities: p.cities.split(',').map((s) => s.trim()).filter(Boolean), hard };
    body.interestedIn = interest;
    try { await api(`/api/customers/${id}`, { method: 'PATCH', body }); nav(`/customers/${id}`); } catch (x) { setErr(x); setBusy(false); }
  }
  if (!v) return err ? <p role="alert" className="text-brand">{err.message}</p> : <p className="text-muted">Loading…</p>;
  return (
    <form onSubmit={save} className="space-y-6">
      <h1 className="text-4xl">Edit profile</h1>
      {err && <div role="alert" className="card border-brand text-sm text-brand">{err.message}{err.details && <ul className="mt-1 list-disc pl-5">{Object.entries(err.details).map(([k, m]) => <li key={k}>{k}: {m.join(', ')}</li>)}</ul>}</div>}
      <div className="card grid gap-x-6 gap-y-5 md:grid-cols-2">
        {F.map(([k, label, kind, opts]) => <label key={k} className={`block text-sm ${kind === 'area' ? 'md:col-span-2' : ''}`}>{label}{REQ.has(k) ? ' *' : ''}
          {kind === 'select' ? <select className="input mt-1" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}>{!REQ.has(k) && <option value="">Not stated</option>}{opts.map((o) => <option key={o}>{o}</option>)}</select>
            : kind === 'area' ? <textarea className="input mt-1 h-20" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            : <input type={kind === 'list' ? 'text' : kind} className="input mt-1" value={v[k]} required={REQ.has(k) && k !== 'bio' && k !== 'country'} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</label>)}
      </div>
      <fieldset className="card"><legend className="px-1 font-serif text-xl">Interested in meeting (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-5 text-sm">{[['men', 'Men'], ['women', 'Women'], ['non-binary', 'Non-binary people'], ['everyone', 'Everyone']].map(([k, l]) => <label key={k}><input type="checkbox" className="mr-2" checked={interest.includes(k)} onChange={(e) => setInterest(e.target.checked ? [...interest, k] : interest.filter((x) => x !== k))} />{l}</label>)}</div>
        <p className="mt-2 text-xs text-muted">Leave empty to use the standard opposite-gender pool. Introductions need both people to be open to each other.</p></fieldset>
      <fieldset className="card grid gap-x-6 gap-y-5 md:grid-cols-2"><legend className="px-1 font-serif text-xl">Partner preferences (optional)</legend>
        {PN.map(([k, l]) => <label key={k} className="block text-sm">{l}<input type="number" className="input mt-1" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></label>)}
        <label className="block text-sm md:col-span-2">Preferred cities (comma-separated)<input className="input mt-1" value={p.cities} onChange={(e) => setP({ ...p, cities: e.target.value })} /></label>
        <div className="md:col-span-2 text-sm"><p>Non-negotiable (excludes anyone who does not meet it; leave unticked for flexible):</p>
          {HARD.map(([k, l]) => <label key={k} className="mr-5 inline-block"><input type="checkbox" className="mr-1" checked={hard.includes(k)} onChange={(e) => setHard(e.target.checked ? [...hard, k] : hard.filter((x) => x !== k))} />{l}</label>)}</div>
      </fieldset>
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><Link to={`/customers/${id}`} className="btn">Cancel</Link></div>
    </form>
  );
}
