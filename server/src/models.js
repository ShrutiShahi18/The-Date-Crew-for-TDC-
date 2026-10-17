import mongoose from 'mongoose';
const { Schema } = mongoose;
// Profile is intentionally flexible (strict:false): customers and candidates share one collection, split by `role`.
const profileSchema = new Schema({ role: String, status: { type: String, default: 'active' }, journeyStatus: { type: String, default: 'Ready for matching' }, assignedTo: { type: Schema.Types.ObjectId, ref: 'User' }, firstName: String, lastName: String, gender: String, city: String }, { strict: false, timestamps: true });
profileSchema.index({ role: 1, gender: 1, status: 1 });
profileSchema.index({ assignedTo: 1, firstName: 1 });
export const Profile = mongoose.model('Profile', profileSchema);
export const User = mongoose.model('User', new Schema({ username: { type: String, unique: true }, displayName: String, passwordHash: String }, { timestamps: true }));
const introSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true }, candidateId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  matchmakerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, scoreAtSend: Number, summary: String, message: String,
  status: { type: String, default: 'Sent' }, delivery: { type: String, default: 'simulated' },
  history: [{ status: String, note: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
introSchema.index({ customerId: 1, candidateId: 1 }, { unique: true }); // blocks duplicate introductions
export const Intro = mongoose.model('Intro', introSchema);
export const Note = mongoose.model('Note', new Schema({ customerId: { type: Schema.Types.ObjectId, index: true }, matchmakerId: Schema.Types.ObjectId, text: String, followUpOn: Date }, { timestamps: true }));
