import mongoose from 'mongoose';
import { createApp } from './app.js';
for (const k of ['MONGODB_URI', 'SESSION_SECRET', 'FRONTEND_ORIGIN']) if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI);
createApp().listen(process.env.PORT || 4000, () => console.log('TDC API ready'));
