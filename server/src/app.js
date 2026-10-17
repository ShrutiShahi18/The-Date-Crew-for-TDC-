import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Profile, User, Intro, Note } from './models.js';
import { scoreMatch, rankCandidates, explain, ageFrom, checkPreferences } from './engine/match.js';
import { generateText } from './gemini.js';
import { createSafetyRouter } from './safety.js';

const prod = process.env.NODE_ENV === 'production';
const toEngine = (p) => ({ ...p, id: String(p._id), age: ageFrom(p.dob) });
// Only these fields may ever appear in an introduction: no phone, email, caste, income or family details.
const publicView = (p) => ({ id: String(p._id), firstName: p.firstName, age: ageFrom(p.dob), city: p.city, designation: p.designation, bio: p.bio, intention: p.intention, interests: p.interests });
const validId = (id) => mongoose.isValidObjectId(id);
// Conversation starters come only from facts both profiles actually state (shared interests, city, intention).
const starters = (a, b) => {
  const out = []; const theirs = (b.interests || []).map((x) => x.toLowerCase());
  for (const i of (a.interests || []).filter((x) => theirs.includes(x.toLowerCase())).slice(0, 2)) out.push(`You both listed ${i}. What got each of you into it?`);
  if (a.city && a.city === b.city) out.push(`You are both based in ${a.city}. What do you each enjoy most about living there?`);
  if (a.intention && a.intention === b.intention) out.push(`You both described what you are looking for as "${a.intention}". What does that mean to each of you?`);
  return out;
};
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const cookieOpts = { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax' };

export function createApp() {
  const app = express();
  if (prod) app.set('trust proxy', 1);
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
  // CSRF defence for cookie auth: mutating calls must carry a custom header, which cross-site forms cannot send.
  app.use((req, res, next) => (req.method !== 'GET' && req.get('x-requested-with') !== 'tdc' ? res.status(403).json({ error: 'Missing CSRF header' }) : next()));

  const auth = (req, res, next) => {
    try { req.userId = jwt.verify(req.cookies.tdc_session, process.env.SESSION_SECRET).sub; next(); } catch { res.status(401).json({ error: 'Not signed in' }); }
  };
  const ownCustomer = wrap(async (req, res, next) => {
    const id = req.params.id;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid id' });
    const c = await Profile.findOne({ _id: id, role: 'customer' }).lean();
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    if (String(c.assignedTo) !== String(req.userId)) return res.status(403).json({ error: 'Not your customer' });
    req.customer = c; next();
  });
  const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 20 }), wrap(async (req, res) => {
    const body = z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Username and password are required' });
    const user = await User.findOne({ username: body.data.username.toLowerCase() });
    if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect username or password' });
    res.cookie('tdc_session', jwt.sign({ sub: String(user._id) }, process.env.SESSION_SECRET, { expiresIn: '8h' }), { ...cookieOpts, maxAge: 8 * 3600_000 });
    res.json({ user: { id: user._id, displayName: user.displayName } });
  }));
  app.post('/api/auth/logout', (req, res) => { res.clearCookie('tdc_session', cookieOpts); res.json({ ok: true }); });
  app.get('/api/me', auth, wrap(async (req, res) => { const u = await User.findById(req.userId).lean(); res.json({ user: { id: u._id, displayName: u.displayName } }); }));

  app.get('/api/customers', auth, wrap(async (req, res) => {
    const page = Math.max(1, +req.query.page || 1), limit = Math.min(50, +req.query.limit || 20);
    const q = { role: 'customer', assignedTo: req.userId };
    if (req.query.city) q.city = String(req.query.city);
    if (req.query.status) q.journeyStatus = String(req.query.status);
    if (req.query.q) q.firstName = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40), 'i');
    const [items, total] = await Promise.all([Profile.find(q).sort({ firstName: 1 }).skip((page - 1) * limit).limit(limit).lean(), Profile.countDocuments(q)]);
    res.json({ data: items.map((p) => ({ ...p, age: ageFrom(p.dob) })), page, total });
  }));
  app.get('/api/customers/:id', auth, ownCustomer, (req, res) => res.json({ data: { ...req.customer, age: ageFrom(req.customer.dob) } }));

  app.get('/api/customers/:id/matches', auth, ownCustomer, wrap(async (req, res) => {
    const intros = await Intro.find({ customerId: req.customer._id }).lean();
    const pool = await Profile.find({ role: 'candidate', status: 'active' }).lean();
    const ranked = rankCandidates(toEngine(req.customer), pool.map(toEngine), { excludeIds: intros.map((i) => String(i.candidateId)) });
    res.json({ data: ranked.slice(0, Math.min(50, +req.query.limit || 30)).map(({ candidate, result }) => ({ candidate: publicView(candidate), filters: { wantsChildren: candidate.wantsChildren ?? null, openToRelocation: candidate.openToRelocation ?? null, verified: !!candidate.verified, gender: candidate.gender }, fits: checkPreferences(toEngine(req.customer), candidate).filter((x) => x.status === 'met').map((x) => x.label), ...result })), eligible: ranked.length });
  }));

  async function pair(customer, candidateId) {
    if (!validId(candidateId)) return null;
    const cand = await Profile.findOne({ _id: candidateId, role: 'candidate' }).lean();
    return cand ? { cand, result: scoreMatch(toEngine(customer), toEngine(cand)) } : null;
  }
  // AI explanation: grounded in computed factors only; the score is never taken from the model.
  app.get('/api/customers/:id/matches/:candidateId/explanation', auth, ownCustomer, aiLimiter, wrap(async (req, res) => {
    const p = await pair(req.customer, req.params.candidateId); if (!p) return res.status(404).json({ error: 'Candidate not found' });
    if (!p.result.eligible) return res.status(422).json({ error: explain(p.result) });
    const base = explain(p.result);
    const ai = await generateText(`Rewrite this matchmaking summary in 3 warm, concise sentences. Use ONLY the facts given. Do not add facts, change the score, predict success, or treat missing info as a mismatch.\n\n${base}`);
    res.json({ text: ai ?? base, source: ai ? 'gemini' : 'fallback', score: p.result.score });
  }));
  app.post('/api/customers/:id/matches/:candidateId/draft', auth, ownCustomer, aiLimiter, wrap(async (req, res) => {
    const p = await pair(req.customer, req.params.candidateId); if (!p) return res.status(404).json({ error: 'Candidate not found' });
    if (!p.result.eligible) return res.status(422).json({ error: explain(p.result) });
    const me = publicView(req.customer), them = publicView(p.cand);
    const fallback = `Dear ${me.firstName},\n\nWe would like to introduce you to ${them.firstName}, ${them.age}, a ${them.designation ?? 'professional'} based in ${them.city}. ${p.result.highlights.slice(0, 2).join('. ')}${p.result.highlights.length ? '.' : ''}${p.result.missing.length ? ' There are a few details we would like to explore with you first.' : ''}\n\nThis is only an introduction, with no obligation either way. If you would like to know more, just reply and we will take it from there.\n\nWarm regards,\nThe Date Crew`;
    const ai = await generateText(`Write a short, respectful introduction email from a matchmaker to ${me.firstName} about ${them.firstName}. Use ONLY these facts: ${JSON.stringify({ about: them, reasons: p.result.highlights.slice(0, 3), openQuestions: p.result.differences.slice(0, 2) })}. Do not claim chemistry, do not imply ${them.firstName} has accepted, do not mention contact details. Plain text, under 150 words.`);
    res.json({ message: ai ?? fallback, source: ai ? 'gemini' : 'fallback', sharedFields: Object.keys(them), starters: starters(toEngine(req.customer), toEngine(p.cand)) });
  }));

  app.post('/api/customers/:id/introductions', auth, ownCustomer, wrap(async (req, res) => {
    const b = z.object({ candidateId: z.string(), message: z.string().min(20).max(2000), draftSource: z.enum(['gemini', 'fallback']).optional(), edited: z.boolean().optional() }).safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'Invalid introduction', details: b.error.flatten().fieldErrors });
    const p = await pair(req.customer, b.data.candidateId); if (!p) return res.status(404).json({ error: 'Candidate not found' });
    if (!p.result.eligible) return res.status(422).json({ error: explain(p.result) }); // score recomputed server-side, never trusted from the client
    try {
      const intro = await Intro.create({ customerId: req.customer._id, candidateId: p.cand._id, matchmakerId: req.userId, scoreAtSend: p.result.score, summary: explain(p.result), message: b.data.message, status: 'Sent', delivery: 'simulated', history: [{ status: 'Drafted', note: `Draft source: ${b.data.draftSource === 'gemini' ? 'Gemini' : 'template'}` }, { status: 'Reviewed', note: b.data.edited ? 'Edited by matchmaker' : 'Approved without edits' }, { status: 'Sent', note: 'Simulated delivery completed; no real email was sent' }] });
      await Profile.updateOne({ _id: req.customer._id }, { journeyStatus: 'Introduction sent' }); // "sent" is not "accepted"
      res.status(201).json({ data: intro, note: 'Delivery is simulated; no real email was sent.' });
    } catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'An introduction for this pair already exists' }); throw e; }
  }));
  app.get('/api/customers/:id/introductions', auth, ownCustomer, wrap(async (req, res) => {
    const list = await Intro.find({ customerId: req.customer._id }).sort({ createdAt: -1 }).lean();
    const cs = await Profile.find({ _id: { $in: list.map((i) => i.candidateId) } }).lean(); const nm = Object.fromEntries(cs.map((p) => [String(p._id), p.firstName]));
    res.json({ data: list.map((i) => ({ ...i, candidateName: nm[String(i.candidateId)] })) });
  }));
  app.get('/api/customers/:id/matches/:candidateId/compare', auth, ownCustomer, wrap(async (req, res) => {
    const p = await pair(req.customer, req.params.candidateId); if (!p) return res.status(404).json({ error: 'Candidate not found' });
    if (!p.result.eligible) return res.status(422).json({ error: explain(p.result) });
    const a = toEngine(req.customer), b = toEngine(p.cand); // rows deliberately exclude income, caste, religion and contact details
    const rows = [['Relationship intention', a.intention, b.intention], ['Wants children', a.wantsChildren, b.wantsChildren], ['Open to relocation', a.openToRelocation, b.openToRelocation], ['City', a.city, b.city], ['Age', a.age, b.age], ['Height (cm)', a.heightCm, b.heightCm], ['Languages', a.languages, b.languages], ['Interests', a.interests, b.interests]];
    res.json({ customer: a.firstName, candidate: b.firstName, result: p.result, rows, customerPrefsOnCandidate: checkPreferences(a, b), candidatePrefsOnCustomer: checkPreferences(b, a), starters: starters(a, b) });
  }));

  app.post('/api/customers/:id/notes', auth, ownCustomer, wrap(async (req, res) => {
    const b = z.object({ text: z.string().min(1).max(2000), followUpOn: z.coerce.date().optional() }).safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'Invalid note' });
    res.status(201).json({ data: await Note.create({ ...b.data, customerId: req.customer._id, matchmakerId: req.userId }) });
  }));
  app.get('/api/customers/:id/notes', auth, ownCustomer, wrap(async (req, res) => res.json({ data: await Note.find({ customerId: req.customer._id }).sort({ createdAt: -1 }).lean() })));

  app.patch('/api/customers/:id', auth, ownCustomer, wrap(async (req, res) => {
    const yn = z.enum(['Yes', 'No', 'Maybe']).nullable(); const t = (n) => z.string().trim().max(n); const num = z.number().nullable();
    const b = z.object({
      firstName: t(60).min(1, 'First name is required'), lastName: t(60).min(1, 'Last name is required'), gender: z.enum(['Male', 'Female', 'Non-binary', 'Other']),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').refine((v) => { const a = ageFrom(v); return a >= 18 && a <= 90; }, 'Age must be between 18 and 90'),
      country: t(60), city: t(60).min(1, 'City is required'), heightCm: z.number().int().min(120, 'Height looks too low').max(230, 'Height looks too high').nullable(),
      email: z.string().trim().email('Enter a valid email').max(120).nullable(), phone: t(25).nullable(), college: t(100).nullable(), degree: t(60).nullable(),
      income: z.number().min(0).max(1000).nullable(), company: t(80).nullable(), designation: t(80).nullable(), maritalStatus: z.enum(['Never married', 'Divorced', 'Widowed']),
      interestedIn: z.array(z.enum(['men', 'women', 'non-binary', 'everyone'])).max(4), languages: z.array(t(30)).max(10), siblings: z.number().int().min(0).max(15).nullable(), caste: t(60).nullable(), religion: t(60).nullable(),
      wantsChildren: yn, openToRelocation: yn, openToPets: yn, intention: z.enum(['marriage', 'long-term', 'open']).nullable(), bio: t(600), interests: z.array(t(30)).max(15),
      familyExpectations: t(300).nullable(), values: t(300).nullable(), lifestyle: t(300).nullable(),
      journeyStatus: z.enum(['New', 'Profile incomplete', 'Ready for matching', 'Introduction sent', 'Awaiting response', 'Connected', 'On hold']),
      prefs: z.object({ ageMin: num, ageMax: num, heightMin: num, incomeMin: num, cities: z.array(t(60)).max(15), hard: z.array(z.enum(['age', 'height', 'income', 'city', 'children'])).max(5) }).partial(),
    }).partial().strict().safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'Invalid update', details: b.error.flatten().fieldErrors });
    const set = {}, unset = {}; for (const [k, v] of Object.entries(b.data)) (v === null ? unset : set)[k] = v; // null clears an optional field
    await Profile.updateOne({ _id: req.customer._id }, { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) });
    res.json({ data: await Profile.findById(req.customer._id).lean() });
  }));
  app.patch('/api/introductions/:iid', auth, wrap(async (req, res) => {
    const b = z.object({ status: z.enum(['Awaiting response', 'Accepted', 'Declined']) }).safeParse(req.body);
    if (!b.success || !validId(req.params.iid)) return res.status(400).json({ error: 'Invalid status' });
    const i = await Intro.findOne({ _id: req.params.iid, matchmakerId: req.userId }); if (!i) return res.status(404).json({ error: 'Introduction not found' });
    const OK = { Sent: ['Awaiting response', 'Accepted', 'Declined'], 'Awaiting response': ['Accepted', 'Declined'] };
    if (!OK[i.status]?.includes(b.data.status)) return res.status(409).json({ error: `Cannot move from "${i.status}" to "${b.data.status}"` });
    i.status = b.data.status; i.history.push({ status: b.data.status, note: 'Updated by matchmaker' }); await i.save();
    if (b.data.status !== 'Declined') await Profile.updateOne({ _id: i.customerId }, { journeyStatus: b.data.status === 'Accepted' ? 'Connected' : 'Awaiting response' });
    res.json({ data: i });
  }));
  app.get('/api/home', auth, wrap(async (req, res) => {
    const mine = await Profile.find({ role: 'customer', assignedTo: req.userId }).lean(); const ids = mine.map((p) => p._id);
    const nm = Object.fromEntries(mine.map((p) => [String(p._id), p.firstName]));
    const intros = await Intro.find({ customerId: { $in: ids } }).sort({ createdAt: -1 }).limit(5).lean();
    const cand = await Profile.find({ _id: { $in: intros.map((i) => i.candidateId) } }).lean(); const cn = Object.fromEntries(cand.map((p) => [String(p._id), p.firstName]));
    const due = await Note.find({ customerId: { $in: ids }, followUpOn: { $lte: new Date(Date.now() + 7 * 864e5) } }).sort({ followUpOn: 1 }).limit(5).lean();
    res.json({ customers: mine.length, awaiting: await Intro.countDocuments({ customerId: { $in: ids }, status: { $in: ['Sent', 'Awaiting response'] } }),
      recent: intros.map((i) => ({ id: i._id, customerId: i.customerId, customer: nm[String(i.customerId)], candidate: cn[String(i.candidateId)], status: i.status, at: i.createdAt })),
      followUps: due.map((n) => ({ id: n._id, customerId: n.customerId, customer: nm[String(n.customerId)], text: n.text, due: n.followUpOn })),
      updated: [...mine].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3).map((p) => ({ id: p._id, name: `${p.firstName} ${p.lastName}`, status: p.journeyStatus })) });
  }));
  app.use('/api/safety', createSafetyRouter(auth, wrap));

  app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Something went wrong' }); });
  return app;
}
