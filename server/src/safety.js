// Trust & Safety prototype: reports, proportionate enforcement, appeals, mock phone verification.
import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { z } from 'zod';
import { Profile } from './models.js';
const { Schema } = mongoose;
const Report = mongoose.model('Report', new Schema({ reporterId: Schema.Types.ObjectId, subjectId: { type: Schema.Types.ObjectId, index: true }, category: String, description: String, interactionRef: String, status: { type: String, default: 'Submitted' }, decision: String, history: [{ status: String, note: String, by: Schema.Types.ObjectId, at: { type: Date, default: Date.now } }] }, { timestamps: true }));
const Enforcement = mongoose.model('Enforcement', new Schema({ profileId: Schema.Types.ObjectId, reportId: Schema.Types.ObjectId, action: String, phoneHash: { type: String, index: true }, active: { type: Boolean, default: true } }, { timestamps: true }));
const Verification = mongoose.model('Verification', new Schema({ profileId: { type: Schema.Types.ObjectId, unique: true }, phoneHash: String, otpHash: String, otpExpires: Date, verified: { type: Boolean, default: false } }, { timestamps: true }));
// Ghosting and "cheater" accusations are deliberately not categories: they are not platform-policy violations.
const CATS = ['Harassment or threats', 'Impersonation', 'Fraud or scams', 'Unwanted sexual behaviour', 'Repeated boundary violations', 'Other policy concern'];
const NEXT = { Submitted: ['Under review'], 'Under review': ['Action taken', 'No violation found'], 'Action taken': ['Appealed', 'Resolved'], 'No violation found': ['Appealed', 'Resolved'], Appealed: ['Under review', 'Resolved'] };
const ACTIONS = ['Warning', 'Temporary restriction', 'Suspension', 'Permanent ban'];
// Phone numbers are stored only as salted hashes for enforcement checks; raw numbers are never logged.
const hash = (s) => crypto.createHash('sha256').update(String(s).replace(/\D/g, '') + (process.env.SESSION_SECRET || '')).digest('hex');
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

export function createSafetyRouter(auth, wrap) {
  const r = Router(); r.use(auth);
  r.get('/profiles', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 40); if (q.length < 2) return res.json({ data: [] });
    const ps = await Profile.find({ firstName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).limit(8).lean();
    res.json({ data: ps.map((p) => ({ id: p._id, name: `${p.firstName} ${p.lastName}`, city: p.city, role: p.role, status: p.status })) });
  }));
  r.post('/reports', wrap(async (req, res) => {
    const b = z.object({ subjectId: oid, category: z.enum(CATS), description: z.string().min(10).max(2000), interactionRef: z.string().max(100).optional() }).safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'Invalid report', details: b.error.flatten().fieldErrors });
    if (!(await Profile.exists({ _id: b.data.subjectId }))) return res.status(404).json({ error: 'Profile not found' });
    res.status(201).json({ data: await Report.create({ ...b.data, reporterId: req.userId, history: [{ status: 'Submitted', by: req.userId }] }) });
  }));
  r.get('/reports', wrap(async (req, res) => {
    const reports = await Report.find().sort({ updatedAt: -1 }).limit(50).lean();
    const ps = await Profile.find({ _id: { $in: reports.map((x) => x.subjectId) } }).lean();
    const nm = Object.fromEntries(ps.map((p) => [String(p._id), `${p.firstName} ${p.lastName} (${p.status})`]));
    res.json({ data: reports.map((x) => ({ ...x, subject: nm[String(x.subjectId)] })) });
  }));
  r.patch('/reports/:id', wrap(async (req, res) => {
    const b = z.object({ status: z.enum(['Under review', 'Action taken', 'No violation found', 'Appealed', 'Resolved']), note: z.string().min(3).max(1000), action: z.enum(ACTIONS).optional(), reinstate: z.boolean().optional() }).safeParse(req.body);
    if (!b.success || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'A status and a review note are required' });
    const rep = await Report.findById(req.params.id); if (!rep) return res.status(404).json({ error: 'Report not found' });
    if (!NEXT[rep.status]?.includes(b.data.status)) return res.status(409).json({ error: `Cannot move from "${rep.status}" to "${b.data.status}"` });
    const prof = await Profile.findById(rep.subjectId);
    if (b.data.status === 'Action taken') {
      if (!b.data.action) return res.status(400).json({ error: 'Choose a proportionate action' });
      const a = b.data.action;
      if (a === 'Temporary restriction' || a === 'Suspension') await Profile.updateOne({ _id: prof._id }, { status: 'suspended' });
      if (a === 'Permanent ban') await Profile.updateOne({ _id: prof._id }, { status: 'blocked' });
      await Enforcement.create({ profileId: prof._id, reportId: rep._id, action: a, phoneHash: prof.phone ? hash(prof.phone) : undefined, active: a !== 'Warning' });
      rep.decision = a;
    }
    if (b.data.status === 'Resolved' && b.data.reinstate) { await Profile.updateOne({ _id: prof._id }, { status: 'active' }); await Enforcement.updateMany({ profileId: prof._id, active: true }, { active: false }); rep.decision = 'Reinstated after review'; }
    rep.status = b.data.status; rep.history.push({ status: b.data.status, note: b.data.note, by: req.userId });
    await rep.save(); res.json({ data: rep });
  }));
  // Mock verification: no SMS is sent and no telecom check happens.
  r.post('/verify/start', wrap(async (req, res) => {
    const b = z.object({ profileId: oid, phone: z.string().min(8).max(20) }).safeParse(req.body); if (!b.success) return res.status(400).json({ error: 'Profile and phone number required' });
    const h = hash(b.data.phone);
    if (await Enforcement.exists({ phoneHash: h, active: true })) return res.status(403).json({ error: 'This phone identifier is under a safety restriction and cannot be used for a new verified profile. Numbers can be shared or recycled, so request a manual review or appeal.' });
    const otp = String(crypto.randomInt(100000, 1000000));
    await Verification.findOneAndUpdate({ profileId: b.data.profileId }, { phoneHash: h, otpHash: hash(otp), otpExpires: new Date(Date.now() + 10 * 60_000), verified: false }, { upsert: true });
    res.json({ mockOtp: otp, note: 'Mock OTP shown for the demo. No SMS was sent and nothing was verified by a telecom provider.' });
  }));
  r.post('/verify/confirm', wrap(async (req, res) => {
    const b = z.object({ profileId: oid, otp: z.string().length(6) }).safeParse(req.body); if (!b.success) return res.status(400).json({ error: 'Enter the 6-digit code' });
    const v = await Verification.findOne({ profileId: b.data.profileId });
    if (!v || v.otpExpires < new Date() || v.otpHash !== hash(b.data.otp)) return res.status(400).json({ error: 'Code is incorrect or expired' });
    v.verified = true; await v.save(); await Profile.updateOne({ _id: v.profileId }, { verified: true });
    res.json({ ok: true, note: 'Marked verified in this prototype only.' });
  }));
  return r;
}
