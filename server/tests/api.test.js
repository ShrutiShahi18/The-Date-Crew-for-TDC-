// API tests. They run only when TEST_MONGODB_URI points at a database whose name contains "test" (the DB is wiped).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const uri = process.env.TEST_MONGODB_URI;
const ok = uri && /test/i.test(uri.split('?')[0].split('/').pop());
const H = { 'X-Requested-With': 'tdc' };
(ok ? describe : describe.skip)('API', () => {
  let agent, cust, other, cand, userId;
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-secret-test-secret-123'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    await mongoose.connect(uri); await mongoose.connection.dropDatabase();
    const { User, Profile } = await import('../src/models.js'); const { createApp } = await import('../src/app.js');
    const u = await User.create({ username: 'mm', displayName: 'MM', passwordHash: await bcrypt.hash('pw12345!', 4) }); userId = u._id;
    const u2 = await User.create({ username: 'other', displayName: 'O', passwordHash: await bcrypt.hash('pw12345!', 4) });
    const base = { dob: '1995-01-01', city: 'Pune', intention: 'marriage', status: 'active' };
    cust = await Profile.create({ ...base, role: 'customer', assignedTo: u._id, firstName: 'Arjun', lastName: 'T', gender: 'Male', phone: '+91 90000 11111' });
    other = await Profile.create({ ...base, role: 'customer', assignedTo: u2._id, firstName: 'Omar', lastName: 'T', gender: 'Male' });
    cand = await Profile.create({ ...base, role: 'candidate', firstName: 'Meera', lastName: 'K', gender: 'Female', phone: '+91 90000 22222' });
    agent = request.agent(createApp());
  });
  afterAll(async () => { await mongoose.disconnect(); });
  it('rejects unauthenticated access', async () => { expect((await agent.get('/api/customers')).status).toBe(401); });
  it('rejects wrong credentials and missing CSRF header', async () => {
    expect((await agent.post('/api/auth/login').set(H).send({ username: 'mm', password: 'nope' })).status).toBe(401);
    expect((await agent.post('/api/auth/login').send({ username: 'mm', password: 'pw12345!' })).status).toBe(403);
  });
  it('logs in and lists only assigned customers', async () => {
    expect((await agent.post('/api/auth/login').set(H).send({ username: 'mm', password: 'pw12345!' })).status).toBe(200);
    const r = await agent.get('/api/customers'); expect(r.body.data.length).toBe(1);
    expect((await agent.get(`/api/customers/${other._id}`)).status).toBe(403);
  });
  it('validates profile edits', async () => {
    expect((await agent.patch(`/api/customers/${cust._id}`).set(H).send({ email: 'not-an-email' })).status).toBe(400);
    expect((await agent.patch(`/api/customers/${cust._id}`).set(H).send({ bio: 'Hello', heightCm: null })).status).toBe(200);
  });
  it('ranks matches and sends one introduction, blocking duplicates and invalid transitions', async () => {
    const m = await agent.get(`/api/customers/${cust._id}/matches`); expect(m.body.data.length).toBe(1);
    expect(JSON.stringify(m.body)).not.toContain('+91');
    const body = { candidateId: String(cand._id), message: 'Dear Arjun, we would like to introduce you to Meera.' };
    const a = await agent.post(`/api/customers/${cust._id}/introductions`).set(H).send(body); expect(a.status).toBe(201); expect(a.body.data.delivery).toBe('simulated');
    expect((await agent.post(`/api/customers/${cust._id}/introductions`).set(H).send(body)).status).toBe(409);
    const id = a.body.data._id;
    expect((await agent.patch(`/api/introductions/${id}`).set(H).send({ status: 'Accepted' })).status).toBe(200);
    expect((await agent.patch(`/api/introductions/${id}`).set(H).send({ status: 'Declined' })).status).toBe(409);
  });
  it('runs the report workflow and blocks a banned phone identifier', async () => {
    const rep = await agent.post('/api/safety/reports').set(H).send({ subjectId: String(cand._id), category: 'Harassment or threats', description: 'Repeated unwanted messages after being asked to stop.' });
    expect(rep.status).toBe(201); const id = rep.body.data._id;
    expect((await agent.patch(`/api/safety/reports/${id}`).set(H).send({ status: 'Action taken', note: 'skip ahead', action: 'Warning' })).status).toBe(409);
    expect((await agent.patch(`/api/safety/reports/${id}`).set(H).send({ status: 'Under review', note: 'Looking at the messages' })).status).toBe(200);
    expect((await agent.patch(`/api/safety/reports/${id}`).set(H).send({ status: 'Action taken', note: 'Serious and repeated', action: 'Permanent ban' })).status).toBe(200);
    const v = await agent.post('/api/safety/verify/start').set(H).send({ profileId: String(other._id), phone: '+91 90000 22222' });
    expect(v.status).toBe(403);
  });
});
