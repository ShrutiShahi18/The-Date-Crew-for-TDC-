import { useState } from 'react';
import { api } from '../api';
import Logo from '../components/Logo';
export default function Login({ onLogin, toggle }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { onLogin((await api('/api/auth/login', { method: 'POST', body: f })).user); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-end bg-brand p-12 text-white md:flex">
        <div className="mb-auto"><Logo light /></div>
        <svg viewBox="0 0 240 160" className="mb-8 w-56 text-white/40" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M10 160V70a50 50 0 0 1 100 0v90M130 160V70a50 50 0 0 1 100 0v90M30 160V74a30 30 0 0 1 60 0v86M150 160V74a30 30 0 0 1 60 0v86" /></svg>
        <h1 className="text-5xl">The art of connection</h1>
        <p className="mt-3 text-white/80">Thoughtfully considered. Personally introduced.</p>
      </div>
      <div className="flex flex-col justify-center p-8">
        <div className="mb-6 flex justify-end">{toggle}</div>
        <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-4">
          <h2 className="text-3xl">Matchmaker sign in</h2>
          <label className="block text-sm">Username<input className="input mt-1" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required /></label>
          <label className="block text-sm">Password<input type="password" className="input mt-1" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></label>
          {err && <p role="alert" className="text-sm text-brand">{err}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
