import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { api } from './api';
import Login from './pages/Login';
import Customers from './pages/Customers';
import Customer from './pages/Customer';
import Home from './pages/Home';
import Logo from './components/Logo';
import EditProfile from './pages/EditProfile';
import Compare from './pages/Compare';
import Safety from './pages/Safety';
import Settings from './pages/Settings';

const DEF = { theme: 'system', size: 'md', contrast: 'normal', motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'on' };
export default function App() {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(() => { try { return { ...DEF, ...JSON.parse(localStorage.tdcPrefs || '{}') }; } catch { return DEF; } });
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const setDark = (d) => setPrefs((p) => ({ ...p, theme: d ? 'dark' : 'light' }));
  useEffect(() => { const r = document.documentElement; r.classList.toggle('dark', dark); r.dataset.size = prefs.size; r.dataset.contrast = prefs.contrast; r.dataset.motion = prefs.motion; try { localStorage.tdcPrefs = JSON.stringify(prefs); } catch { /* storage unavailable */ } }, [prefs, dark]);
  useEffect(() => { api('/api/me').then((d) => setUser(d.user)).catch(() => setUser(null)); }, []);
  const toggle = (
    <button className="btn" onClick={() => setDark(!dark)} aria-label="Toggle light or dark theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
  );
  if (user === undefined) return <p className="p-8 text-muted">Loading…</p>;
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login onLogin={(u) => { setUser(u); navigate('/'); }} toggle={toggle} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
        <nav className="flex items-center gap-5"><Link to="/" aria-label="The Date Crew home"><Logo /></Link><Link to="/customers" className="text-sm">Customers</Link><Link to="/safety" className="text-sm">Trust &amp; Safety</Link><Link to="/settings" className="text-sm">Settings</Link></nav>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{user.displayName}</span>{toggle}
          <button className="btn" onClick={async () => { await api('/api/auth/logout', { method: 'POST' }); setUser(null); }}><LogOut size={16} /> Sign out</button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <Routes><Route path="/" element={<Home user={user} />} /><Route path="/customers" element={<Customers />} /><Route path="/customers/:id/edit" element={<EditProfile />} /><Route path="/customers/:id/compare/:cid" element={<Compare />} /><Route path="/safety" element={<Safety />} /><Route path="/settings" element={<Settings prefs={prefs} setPrefs={setPrefs} reset={() => setPrefs(DEF)} />} /><Route path="*" element={<Navigate to="/" replace />} /><Route path="/customers/:id" element={<Customer />} /></Routes>
      </main>
    </div>
  );
}