import { describe, it, expect } from 'vitest';
import { scoreMatch, rankCandidates, explain, ageFrom } from '../src/engine/match.js';
const P = (o) => ({ id: Math.random().toString(36).slice(2), gender: 'Female', status: 'active', age: 30, ...o });
describe('eligibility', () => {
  it('rejects same gender, self, suspended', () => {
    const a = P({ gender: 'Male' });
    expect(scoreMatch(a, P({ gender: 'Male' })).eligible).toBe(false);
    expect(scoreMatch(a, a).eligible).toBe(false);
    expect(scoreMatch(a, P({ status: 'suspended' })).eligible).toBe(false);
  });
  it('rejects on a hard constraint but not on a soft one', () => {
    const hard = P({ gender: 'Male', prefs: { ageMax: 28, hard: ['age'] } });
    const soft = P({ gender: 'Male', prefs: { ageMax: 28 } });
    expect(scoreMatch(hard, P({ age: 33 })).eligible).toBe(false);
    expect(scoreMatch(soft, P({ age: 33 })).eligible).toBe(true);
  });
  it('rejects a hard children conflict', () => {
    expect(scoreMatch(P({ gender: 'Male', wantsChildren: 'Yes', prefs: { hard: ['children'] } }), P({ wantsChildren: 'No' })).eligible).toBe(false);
  });
});
describe('scoring', () => {
  it('is reciprocal', () => {
    const r = scoreMatch(P({ gender: 'Male', prefs: { ageMax: 28 } }), P({ age: 33, prefs: { ageMax: 40 } }));
    expect(r.differences.some((d) => d.includes('age range'))).toBe(true);
  });
  it('is gender-neutral: a woman earning more is not penalised', () => {
    const w = P({ income: 40 }), m = P({ gender: 'Male', income: 10 });
    expect(scoreMatch(w, m).score).toBe(scoreMatch(m, w).score);
  });
  it('treats unknown as unknown, lowers confidence, not score', () => {
    const r = scoreMatch(P({ gender: 'Male' }), P({}));
    expect(r.eligible).toBe(true); expect(r.confidence).toBe(0); expect(r.missing.length).toBeGreaterThan(0);
  });
  it('keeps score in 0..100 and orders stably', () => {
    const c = P({ gender: 'Male', intention: 'marriage' });
    const r = rankCandidates(c, ['b', 'a', 'c'].map((id) => P({ id, intention: 'marriage' })));
    expect(r.map((x) => x.candidate.id)).toEqual(['a', 'b', 'c']);
    r.forEach((x) => expect(x.result.score >= 0 && x.result.score <= 100).toBe(true));
  });
  it('explanation restates computed score', () => {
    const r = scoreMatch(P({ gender: 'Male', intention: 'marriage' }), P({ intention: 'marriage' }));
    expect(explain(r)).toContain(`${r.score}/100`);
  });
});
describe('ageFrom', () => { it('computes age', () => expect(ageFrom('2000-06-15', new Date('2026-06-14'))).toBe(25)); });
describe('additional engine cases', () => {
  it('excludes blocked and suspended candidates from ranking', () => {
    const r = rankCandidates(P({ gender: 'Male' }), [P({ id: 'a', status: 'blocked' }), P({ id: 'b', status: 'suspended' }), P({ id: 'c' })]);
    expect(r.map((x) => x.candidate.id)).toEqual(['c']);
  });
  it('applies a height preference identically for either gender', () => {
    expect(scoreMatch(P({ prefs: { heightMin: 175 } }), P({ gender: 'Male', heightCm: 170 })).differences.some((d) => d.includes('height'))).toBe(true);
    expect(scoreMatch(P({ gender: 'Male', prefs: { heightMin: 175 } }), P({ heightCm: 170 })).differences.some((d) => d.includes('height'))).toBe(true);
  });
  it('does not penalise income differences without a stated preference', () => {
    expect(scoreMatch(P({ gender: 'Male', income: 5 }), P({ income: 50 })).differences.length).toBe(0);
  });
  it('Maybe on children is not a conflict', () => {
    expect(scoreMatch(P({ gender: 'Male', wantsChildren: 'Maybe', prefs: { hard: ['children'] } }), P({ wantsChildren: 'No' })).eligible).toBe(true);
  });
  it('unknown preference data is missing information, not a mismatch, and cannot trigger a hard rejection', () => {
    const r = scoreMatch(P({ gender: 'Male', prefs: { heightMin: 170, hard: ['height'] } }), P({}));
    expect(r.eligible).toBe(true); expect(r.missing.some((m) => m.includes('height'))).toBe(true); expect(r.differences.length).toBe(0);
  });
  it('age preference is reciprocal and soft by default', () => {
    const r = scoreMatch(P({ gender: 'Male', age: 40, prefs: { ageMin: 35, ageMax: 45 } }), P({ age: 28, prefs: { ageMin: 30, ageMax: 36 } }));
    expect(r.eligible).toBe(true); expect(r.differences.length).toBeGreaterThan(0);
  });
});
describe('stated gender openness', () => {
  it('keeps the opposite-gender default and honours mutual stated openness', () => {
    expect(scoreMatch(P({ gender: 'Male' }), P({ gender: 'Female' })).eligible).toBe(true);
    const a = P({ gender: 'Female', interestedIn: ['women'] });
    expect(scoreMatch(a, P({ gender: 'Female', interestedIn: ['women', 'men'] })).eligible).toBe(true);
    expect(scoreMatch(a, P({ gender: 'Female' })).eligible).toBe(false);
  });
});
