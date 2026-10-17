# Architecture
- **Client:** React + Vite + Tailwind SPA. Theme tokens are CSS variables; `api.js` sends cookies and the `X-Requested-With` header.
- **API:** Express. Routes in `app.js` and `safety.js`; business logic in `engine/` (pure, no I/O) and `gemini.js` (server-only AI call with fallback).
- **Data:** MongoDB via Mongoose. `Profile` holds customers and candidates (split by `role`); `Intro`, `Note`, `Report`, `Enforcement`, `Verification`, `User`. A unique index on (customer, candidate) prevents duplicate introductions.
- **Auth:** bcrypt-hashed passwords, JWT in an HTTP-only cookie, CSRF custom-header check, rate-limited login.
- **Matching:** hard constraints exclude; weighted, reciprocal, stated-preference scoring; unknowns lower confidence only. Scores are recomputed server-side at send time.
- **AI:** Gemini rewrites explanations and drafts intros from computed facts only; template fallback is labelled.
- **Safety:** report workflow with enforced transitions, proportionate actions, appeals, mock OTP and hashed phone identifiers.
