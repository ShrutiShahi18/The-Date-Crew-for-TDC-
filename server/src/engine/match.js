// Deterministic, explainable matching engine. No Express, no AI, no I/O.
// Weights are configurable. Unknown data is excluded from the score and lowers `confidence` instead.
export const WEIGHTS = { intention: 25, children: 20, preferences: 30, location: 10, interests: 10, languages: 5 };

export function ageFrom(dob, now = new Date()) {
  if (!dob) return null;
  const d = new Date(dob); if (isNaN(d)) return null;
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

const inRange = (v, lo, hi) => (lo == null || v >= lo) && (hi == null || v <= hi);
const isActive = (p) => (p.status ?? 'active') === 'active';

// Checks one person's *stated* preferences against the other. Same code for every gender:
// nothing here assumes who should be older, taller or higher-earning.
export function checkPreferences(seeker, cand) {
  const p = seeker.prefs || {};
  const out = [];
  const add = (key, label, val, ok, active) => { if (active) out.push({ key, label, status: val == null ? 'unknown' : ok(val) ? 'met' : 'missed' }); };
  add('age', 'age range', cand.age, (v) => inRange(v, p.ageMin, p.ageMax), p.ageMin != null || p.ageMax != null);
  add('height', 'height range', cand.heightCm, (v) => inRange(v, p.heightMin, p.heightMax), p.heightMin != null || p.heightMax != null);
  add('income', 'income expectation', cand.income, (v) => v >= p.incomeMin, p.incomeMin != null);
  add('city', 'preferred cities', cand.city, (v) => p.cities.includes(v), p.cities?.length > 0);
  return out;
}

const childrenConflict = (a, b) => (a.wantsChildren === 'Yes' && b.wantsChildren === 'No') || (a.wantsChildren === 'No' && b.wantsChildren === 'Yes');

function hardFailures(a, b) {
  const fails = [];
  for (const [who, other, name] of [[a, b, 'Customer'], [b, a, 'Candidate']]) {
    const hard = who.prefs?.hard || [];
    for (const c of checkPreferences(who, other)) if (c.status === 'missed' && hard.includes(c.key)) fails.push(`${name}'s non-negotiable ${c.label} is not met`);
    if (hard.includes('children') && childrenConflict(a, b)) fails.push(`${name}'s non-negotiable on children conflicts`);
  }
  return [...new Set(fails)];
}

const INTENT = { marriage: 'marriage', 'long-term': 'long-term', open: 'open to either' };
function intentionValue(a, b) {
  if (!a.intention || !b.intention) return null;
  if (a.intention === b.intention) return 1;
  const s = new Set([a.intention, b.intention]);
  if (s.has('open')) return 0.6;
  if (s.has('marriage') && s.has('long-term')) return 0.8;
  return 0.2;
}
function childrenValue(a, b) {
  if (!a.wantsChildren || !b.wantsChildren) return null;
  if (childrenConflict(a, b)) return 0;
  return a.wantsChildren === b.wantsChildren && a.wantsChildren !== 'Maybe' ? 1 : 0.6;
}
const relo = { Yes: 0.9, Maybe: 0.5, No: 0 };
function locationValue(a, b) {
  if (a.city && a.city === b.city) return 1;
  const x = relo[a.openToRelocation], y = relo[b.openToRelocation];
  if (x == null && y == null) return null;
  return Math.max(x ?? 0, y ?? 0);
}
function overlap(x = [], y = []) { const s = new Set(x.map((v) => v.toLowerCase())); return y.filter((v) => s.has(v.toLowerCase())); }

const GKEY = { Male: 'men', Female: 'women', 'Non-binary': 'non-binary', Other: 'non-binary' };
// With no stated preference we keep the assessment's opposite-gender pool; people can state who they are open to meeting. Both sides must accept.
export const accepts = (p, o) => (!p.interestedIn?.length ? p.gender !== o.gender : p.interestedIn.includes('everyone') || p.interestedIn.includes(GKEY[o.gender]));

export function scoreMatch(a, b, weights = WEIGHTS) {
  if (a.id === b.id) return { eligible: false, reasons: ['Same person'] };
  if (!accepts(a, b) || !accepts(b, a)) return { eligible: false, reasons: ['Outside the stated gender preferences of one or both people (default: opposite-gender pool)'] };
  if (!isActive(a) || !isActive(b)) return { eligible: false, reasons: ['Profile is blocked, suspended or inactive'] };
  const hard = hardFailures(a, b);
  if (hard.length) return { eligible: false, reasons: hard };

  const prefs = [...checkPreferences(a, b), ...checkPreferences(b, a)];
  const known = prefs.filter((c) => c.status !== 'unknown');
  const sharedInterests = overlap(a.interests, b.interests);
  const sharedLangs = overlap(a.languages, b.languages);
  const interestsKnown = a.interests?.length && b.interests?.length;
  const langsKnown = a.languages?.length && b.languages?.length;

  const factors = [
    { key: 'intention', value: intentionValue(a, b),
      note: a.intention && b.intention ? `Relationship intentions: ${INTENT[a.intention] ?? a.intention} and ${INTENT[b.intention] ?? b.intention}` : 'Relationship intention not stated by both' },
    { key: 'children', value: childrenValue(a, b),
      note: a.wantsChildren && b.wantsChildren ? `Views on children: ${a.wantsChildren} and ${b.wantsChildren}` : 'Views on children not stated by both' },
    { key: 'preferences', value: known.length ? known.filter((c) => c.status === 'met').length / known.length : null,
      note: known.length ? `${known.filter((c) => c.status === 'met').length} of ${known.length} stated partner preferences are met across both profiles` : 'No comparable partner preferences stated' },
    { key: 'location', value: locationValue(a, b),
      note: a.city && a.city === b.city ? `Both are based in ${a.city}` : 'Different cities; relocation openness decides workability' },
    { key: 'interests', value: interestsKnown ? Math.min(1, (sharedInterests.length / new Set([...a.interests, ...b.interests]).size) * 3) : null,
      note: sharedInterests.length ? `Shared interests: ${sharedInterests.join(', ')}` : interestsKnown ? 'No shared interests listed' : 'Interests not listed by both' },
    { key: 'languages', value: langsKnown ? (sharedLangs.length ? 1 : 0) : null,
      note: sharedLangs.length ? `Common languages: ${sharedLangs.join(', ')}` : langsKnown ? 'No common language listed' : 'Languages not listed by both' },
  ].map((f) => ({ ...f, weight: weights[f.key] }));

  const knownW = factors.filter((f) => f.value != null).reduce((s, f) => s + f.weight, 0);
  const earned = factors.filter((f) => f.value != null).reduce((s, f) => s + f.weight * f.value, 0);
  const total = factors.reduce((s, f) => s + f.weight, 0);
  const score = knownW ? Math.round((earned / knownW) * 100) : 0;
  const confidence = Math.round((knownW / total) * 100);
  return {
    eligible: true, score, confidence, factors,
    highlights: factors.filter((f) => f.value != null && f.value >= 0.8).map((f) => f.note),
    differences: [...factors.filter((f) => f.value != null && f.value < 0.5).map((f) => f.note),
      ...prefs.filter((c) => c.status === 'missed').map((c) => `A stated ${c.label} is not met`)],
    missing: [...factors.filter((f) => f.value == null).map((f) => f.note), ...prefs.filter((c) => c.status === 'unknown').map((c) => `Cannot check ${c.label}: information missing`)],
  };
}

// Deterministic explanation that only restates computed factors (also the AI fallback).
export function explain(r) {
  if (!r.eligible) return `Not eligible: ${r.reasons.join('; ')}.`;
  const parts = [`Internal compatibility indicator: ${r.score}/100 (confidence ${r.confidence}%). It is not a prediction of relationship success.`];
  if (r.highlights.length) parts.push(`Strengths: ${r.highlights.join('; ')}.`);
  if (r.differences.length) parts.push(`Worth discussing: ${r.differences.join('; ')}.`);
  if (r.missing.length) parts.push(`Not yet known: ${r.missing.join('; ')}.`);
  return parts.join(' ');
}

export function rankCandidates(customer, pool, { excludeIds = [], weights = WEIGHTS } = {}) {
  const skip = new Set(excludeIds);
  return pool.filter((c) => !skip.has(c.id)).map((c) => ({ candidate: c, result: scoreMatch(customer, c, weights) }))
    .filter((x) => x.result.eligible)
    .sort((x, y) => y.result.score - x.result.score || y.result.confidence - x.result.confidence || (x.candidate.id < y.candidate.id ? -1 : 1));
}
