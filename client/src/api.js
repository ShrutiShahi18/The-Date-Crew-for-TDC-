const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'tdc' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.details = data.details; throw e; }
  return data;
}
