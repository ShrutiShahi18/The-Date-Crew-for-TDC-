// Run explicitly: `npm run seed`. Replaces seeded data only; never runs on server start.
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Profile, User, Intro, Note } from '../src/models.js';
import { buildProfiles } from '../src/data/seed-data.js';

await mongoose.connect(process.env.MONGODB_URI);
await Promise.all([Profile.deleteMany({ seed: true }), User.deleteMany({ username: 'matchmaker' }), Intro.deleteMany({}), Note.deleteMany({})]);
await Promise.all([Profile.syncIndexes(), Intro.syncIndexes()]);

// Fixed IDs: reseeding gives every profile the same URL, so old links and sessions keep working.
const oid = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'));
const password = process.env.DEMO_PASSWORD || 'Matchmaker#2026';
const user = await User.create({ _id: oid(1), username: 'matchmaker', displayName: 'Demo Matchmaker', passwordHash: await bcrypt.hash(password, 12) });
const docs = buildProfiles().map((p, i) => ({
  ...p, _id: oid(1000 + i),
  ...(p.role === 'customer' ? { assignedTo: user._id, journeyStatus: 'Ready for matching' } : {}),
}));
await Profile.insertMany(docs);

console.log(`Seeded ${docs.length} profiles. Login: matchmaker / ${process.env.DEMO_PASSWORD ? '(your DEMO_PASSWORD)' : password}`);
await mongoose.disconnect();