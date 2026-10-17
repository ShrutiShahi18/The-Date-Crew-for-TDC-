# 🏛️ The Date Crew Matchmaker — Explainable Matchmaking

**Live Demo:** https://the-date-crew-for-tdc-vexf.onrender.com

> Thoughtfully considered. Personally introduced.

[![MongoDB](https://img.shields.io/badge/MongoDB-Persistence-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas) [![Express](https://img.shields.io/badge/Express-API-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/) [![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/) [![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/) [![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat&logo=googlegemini&logoColor=white)](https://ai.google.dev/) [![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/) [![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/) [![Tailwind](https://img.shields.io/badge/Tailwind-Styling-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/) [![Vitest](https://img.shields.io/badge/Vitest-Testing-6E9F18?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/) [![Render](https://img.shields.io/badge/Render-Live_Deployment-46E3B7?style=flat&logo=render&logoColor=black)](https://render.com/)

📡 **API:** <your-api-url> · 🔑 **Demo login:** `matchmaker` / `Matchmaker#2026` (synthetic data only)

The Date Crew Matchmaker is an internal workspace for human matchmakers, built for The Date Crew's working-session assessment. It lets a matchmaker manage customers, inspect full profiles, find compatible people, understand why someone is recommended, and send a thoughtful introduction.

The main idea is simple: **compatibility is calculated by transparent, deterministic rules, never by an LLM.** AI only helps explain a match in plain language and draft an introduction the matchmaker can edit before anything is sent.

---

## Features

### Accounts and access

Login uses bcrypt-hashed passwords and an HTTP-only cookie session. Login attempts are rate-limited, mutating requests need a CSRF header, and each matchmaker can only see and edit their own assigned customers.

### Customer profiles

A searchable, paginated directory and a full profile and edit form covering all 22 required biodata fields: first and last name, gender, date of birth, country, city, height, email, phone, undergraduate college, degree, income, company, designation, marital status, languages, siblings, caste, religion, and Yes/No/Maybe answers for wanting children, relocating and pets.

It also stores relationship intention, bio, interests, family expectations, values, lifestyle, partner preferences (age, height, income, cities) and optional non-negotiables. Optional fields can stay empty; missing information is never filled in.

### Matching, discovery and comparison

Ranked suggestions come with the stated preferences each candidate meets, shared ground, and points worth exploring. Filters cover city, age, gender, intention, children and relocation, with sorting by overall fit, compatibility, confidence, age or city. A comparison page shows both people's preferences applied to each other, differences, unknowns and conversation starters built only from shared details.

### Introductions, notes and follow-ups

Send Match opens a review dialog with an editable draft and the exact fields that will be shared. Each introduction keeps a timeline: Drafted → Reviewed → Sent → Awaiting response / Accepted / Declined, with invalid status jumps rejected. Notes support follow-up dates, which feed the home page.

### Trust & Safety (prototype)

Reports, proportionate enforcement, appeals, reinstatement and mock phone verification. Details and limits are in [Trust & Safety](#trust--safety-prototype-limitations).

### Design and accessibility

A Roman-inspired look: ivory and burgundy in light mode, charcoal in dark mode, with an arch-based logo and portrait frames. Settings cover theme (light, dark, follow device), text size, higher contrast and reduced motion. There is a skip link, labelled forms and visible focus states.

---

## Stack

| Part | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Router, Lucide |
| Backend | Node.js, Express, Zod |
| Database | MongoDB Atlas, Mongoose |
| Authentication | bcrypt, JWT in an HTTP-only cookie |
| AI | Google Gemini (server-side, with fallback) |
| Testing | Vitest, Supertest |
| Deployment | Render (API), Vercel or Netlify (client) |

---

## Architecture

```
React + Vite client
      │  REST + HTTP-only cookie
      ▼
Express API ──► routes (app.js, safety.js)
      │            │
      │            ├─► engine/match.js   deterministic scoring (no I/O, no AI)
      │            └─► gemini.js         explanation + draft, template fallback
      ▼
MongoDB Atlas (Mongoose)
```

- **Routes** validate input with Zod, check ownership of the customer, and call the engine. Scores are always computed on the server and never trusted from the client.
- **The engine** is a pure module, so it is easy to test and does not depend on Express or Gemini.
- **Collections:** `Profile` (customers and candidates, split by `role`), `User`, `Intro`, `Note`, `Report`, `Enforcement`, `Verification`. A unique index on customer + candidate blocks duplicate introductions.
- More detail: [`docs/architecture.md`](docs/architecture.md).

---

## Matching algorithm

### Eligibility (before ranking)

A pair is dropped if any of these is true:

- It is the same person.
- Either profile is blocked, suspended or inactive.
- Either person does not accept the other's gender (see the design decision below).
- A **hard constraint** is not met. Hard constraints are preferences a customer explicitly marked non-negotiable: age, height, income, city or children.

An introduction that already exists for the pair is excluded from suggestions.

### Preferences, in three levels

1. **Hard constraints:** exclude.
2. **Stated preferences:** age range, height range, minimum income and preferred cities rank candidates, but never exclude.
3. **Unknown:** if the other person has not stated a value, the preference is reported as "cannot check". It is never counted as a mismatch, and it cannot trigger a hard rejection.

Preferences are checked in **both directions**: does the candidate meet the customer's preferences, and does the customer meet the candidate's?

### Scoring

```
score      = round( Σ weight × value  ÷  Σ weight, over factors where both people stated something × 100 )
confidence = known weight ÷ 100
```

| Factor | Weight | How the 0–1 value is set |
| --- | --- | --- |
| Mutual partner preferences | 30 | share of checkable preferences met, across both directions |
| Relationship intention | 25 | same = 1, marriage vs long-term = 0.8, open vs any = 0.6, otherwise 0.2 |
| Views on children | 20 | Yes vs No = 0, same answer = 1, anything involving Maybe = 0.6 |
| Location and relocation | 10 | same city = 1, otherwise the more flexible person's relocation answer (Yes 0.9, Maybe 0.5, No 0) |
| Shared interests | 10 | overlap scaled so a few shared interests score well |
| Shared languages | 5 | any common language = 1 |

- **Why these weights:** intention, children and stated preferences matter most for a marriage-oriented match, and interests and languages least. This is a product judgement, not a validated finding. The weights live in one `WEIGHTS` object and can be changed.
- **Confidence** shows how much of the picture a score rests on. Cards say "X% of details known", and the default "Best overall" sort nudges well-documented matches up using `score × (0.5 + confidence ÷ 200)`. That sort changes display order only, never a score.
- The score is an **internal compatibility indicator**, not a probability of relationship success. Income, appearance, popularity and social status are not scoring signals. Caste and religion are stored privately and used only if a person has stated a related preference.

### Design decision: gender-specific matching

The brief asks for gender-specific matching and gives an example where men are matched with younger, shorter, lower-earning women. This project does **not** hard-code that assumption. It supports the required gender-specific eligibility path and keeps the standard opposite-gender pool as the default, but applies identical logic to every person: criteria such as age, height and income come only from what each individual states, and are checked in both directions. A woman who earns more than her match, or a man who is shorter, is not penalised. People can also state who they are open to meeting, and introductions need both sides to be open.

---

## AI integration and fallback

Gemini is called only from the Express backend and does two jobs:

1. **Match explanation:** a short plain-language summary built from the engine's computed strengths, differences and unknowns.
2. **Introduction draft:** a respectful, editable message built from public profile facts and the compatibility reasons.

**Guardrails**

- The model never produces or changes a score.
- Prompts contain only computed factors and a trimmed public profile, never phone, email, income, caste or family details.
- Prompts are not logged, and the API key is never sent to the browser.
- AI routes are rate-limited (20 requests per minute).

**Fallback:** if there is no key, the request fails, quota runs out or the output is empty or malformed, the server returns a deterministic template. The interface labels it "template" instead of presenting it as AI. Matching and sending work fully without a key.

**Getting a key:** create one at [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`. The model defaults to `gemini-2.5-flash` and can be changed with `GEMINI_MODEL`. (Used Gemini API because of OpenAI's paid credit limits)

---

## Introductions and delivery

Delivery is **simulated**. Saving an introduction records status `Sent` with `delivery: "simulated"`; no email is sent to anyone. Sent never means accepted. Each introduction stores the matchmaker, the score at send time, a grounded summary, the message, and a timeline of every status change.

**Shared with a match:** first name, age, city, designation, short bio, relationship intention, interests.
**Always private:** phone, email, income, caste, religion, family details and internal notes.

---

## Trust & Safety (prototype limitations)

- **Reports** follow Submitted → Under review → Action taken / No violation found → Appealed → Resolved, and illegal jumps are rejected.
- **Actions** are proportionate: warning, temporary restriction, suspension, permanent ban. A review note is required for every decision, and each report keeps an audit history.
- **Appeals** can reopen a review or resolve with reinstatement.
- **Ghosting is not a reportable category,** and an allegation is shown as unverified until reviewed. Safety decisions never feed into compatibility scores.
- **Phone verification is a mock.** The one-time code is shown on screen, no SMS is sent, and nothing is checked with a telecom provider. Numbers are stored as salted hashes, and a number tied to an active ban cannot be reused for a new verified profile. Shared or recycled numbers are handled through the appeal and reinstate path.

This demonstrates the workflow. It is not production identity verification or a full moderation operation.

---

## API

Everything except login needs the session cookie, and mutating requests need `X-Requested-With: tdc`.

```
POST  /api/auth/login
POST  /api/auth/logout
GET   /api/me
GET   /api/home

GET   /api/customers
GET   /api/customers/:id
PATCH /api/customers/:id
GET   /api/customers/:id/matches
GET   /api/customers/:id/matches/:candidateId/explanation
GET   /api/customers/:id/matches/:candidateId/compare
POST  /api/customers/:id/matches/:candidateId/draft

POST  /api/customers/:id/introductions
GET   /api/customers/:id/introductions
PATCH /api/introductions/:iid
GET   /api/customers/:id/notes
POST  /api/customers/:id/notes

GET   /api/safety/profiles
POST  /api/safety/reports
GET   /api/safety/reports
PATCH /api/safety/reports/:id
POST  /api/safety/verify/start
POST  /api/safety/verify/confirm
```

---

## Running locally

You need Node.js 20.6 or newer and a MongoDB Atlas cluster (the free tier is fine). In Atlas, create a database user and add your IP under Network Access.

### 1. Backend

```
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

The API runs on `http://localhost:4000`.

### 2. Frontend

```
cd client
cp .env.example .env
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

### Environment variables

**`server/.env`**

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string, ending in `/tdc` |
| `SESSION_SECRET` | Long random string used to sign sessions and hash phone identifiers |
| `FRONTEND_ORIGIN` | Exact client URL, used for CORS (`http://localhost:5173` locally) |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default 4000) |
| `GEMINI_API_KEY` | Optional; without it the template fallback is used |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `DEMO_PASSWORD` | Optional; overrides the seeded demo password |
| `TEST_MONGODB_URI` | Optional; throwaway database for API tests |

**`client/.env`**

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL. Frontend variables are public, so never put secrets here. |

### Database and seeding

`npm run seed` replaces the seeded data only and never runs on server start. It creates:

- **220 synthetic candidates** (110 female, 110 male) with varied cities, education, jobs, incomes, languages, interests and relationship intentions. Some profiles are deliberately incomplete.
- **4 assigned customers** and the demo matchmaker account.

The data comes from a fixed seed, so reseeding gives the same demo each time. Names are unique, dates of birth drive the calculated ages, and all emails and phone numbers are fictional.

---

## Testing

```
cd server
npm test
```

Engine tests cover hard-constraint rejection, reciprocal preferences, age preferences, height and income without gender assumptions, children, unknown and missing data, gender eligibility, blocked and suspended candidates, score bounds, stable ordering, and explanations matching the computed score.

API tests in `server/tests/api.test.js` cover login and CSRF failures, access limited to your own customers, profile validation, duplicate introductions, status transitions, the report workflow and banned-number blocking. They run only when `TEST_MONGODB_URI` points to a throwaway database whose name contains `test`, because it is wiped.

Build the frontend with `cd client && npm run build`.

---

## Deployment

1. **API (Render):** root `server`, build `npm install`, start `npm start`. Set `MONGODB_URI`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, `NODE_ENV=production`, and optionally `GEMINI_API_KEY`.
2. **Client (Vercel or Netlify):** root `client`, build `npm run build`, output `dist`, set `VITE_API_URL`, and rewrite all paths to `/index.html`.
3. Seed once by running `npm run seed` locally with the production `MONGODB_URI` in `server/.env`.

**CORS and cookies:** in production the session cookie is `Secure` with `SameSite=None`, and the API trusts one origin, so `FRONTEND_ORIGIN` must match the client URL exactly (no trailing slash).

---

## Troubleshooting

**`Missing env var` on start:** the scripts read `server/.env`, so check the file exists and is named exactly that.

**Cannot connect to the database:** add your IP under Network Access in Atlas and URL-encode special characters in the password.

**Login fails after deploying:** check that `FRONTEND_ORIGIN` matches the client URL and `VITE_API_URL` points to the API.

---

## Project structure

```
the-date-crew-mvp/
├── client/        # React + Vite frontend
│   └── src/
│       ├── components/   # Logo, ScoreRing
│       └── pages/        # Login, Home, Customers, Customer, EditProfile, Compare, Safety, Settings
├── server/
│   ├── src/
│   │   ├── engine/    # deterministic matching engine
│   │   ├── data/      # seeded synthetic profiles
│   │   ├── app.js     # routes
│   │   ├── safety.js  # Trust & Safety
│   │   └── gemini.js  # AI call with fallback
│   ├── scripts/seed.js
│   └── tests/
└── docs/          # architecture, assessment write-up, product research, checklist
```

---

## Assessment write-up

**AI.** The matching engine decides compatibility; Gemini never scores anyone. After the engine scores a pair, the backend sends Gemini only the computed strengths, differences and unknowns plus a trimmed public profile, and asks for a short explanation and an editable introduction draft. The key stays on the server, and if it is missing, quota runs out or the output is invalid, a labelled template is returned instead.

**Matching.** Candidates are filtered to eligible pairs (active profiles, mutual openness to each other's gender, no broken non-negotiables), then scored 0–100 across intention, children, mutual partner preferences, location, interests and languages. Preferences are checked in both directions, and missing information lowers confidence rather than counting as a mismatch.

**Why stated preferences.** The brief's example (older, taller, higher-earning men) encodes a stereotype, so the engine uses each person's own stated criteria with identical logic for every gender. Limitations: synthetic data, a simple weighting model not validated against outcomes, simulated delivery and phone verification.

See also [`docs/assessment-writeup.md`](docs/assessment-writeup.md), [`docs/architecture.md`](docs/architecture.md), [`docs/product-research.md`](docs/product-research.md) and [`docs/submission-checklist.md`](docs/submission-checklist.md).

---

## Limitations

- All profiles, emails and phone numbers are synthetic.
- Introduction delivery and phone verification are simulated.
- The compatibility percentage is a rule-based internal indicator and has not been validated against real outcomes.
- Sessions are stateless JWTs, so a stolen token stays valid until it expires.
- The product research is a short desk review, not a survey of every dating app.

---

## Why I built it

Matching software can easily turn into a black box with a number on top. I wanted to build the opposite: a tool where every recommendation traces back to what two people actually stated, where unknown information stays unknown, and where AI helps with the words but never decides who is compatible.

The score is the easy part. The interesting work is around it: reciprocal preferences, hard constraints that filters cannot override, privacy rules for what an introduction may contain, and a safety workflow that is proportionate instead of punitive.
