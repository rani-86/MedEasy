# Medeasy

A hospital resource management platform addressing three problems: long OPD waiting queues, no
real-time visibility into bed availability, and slow patient admission — with a city-wide,
multi-hospital network as the intended endpoint. Patients, doctors, and hospital admins each get
a purpose-built flow rather than one generic "user" role. The full build sequence against that
problem statement — patient intake, hospital registration/verification, nearest-hospital search,
bed admission, and emergency alerts — is complete; see [Roadmap](#roadmap-vs-problem-statement)
for what's real versus deliberately left as described vision.

## Live demo

- Frontend: https://medeasy-taupe.vercel.app
- Backend: https://medeasy-zjs8.onrender.com (free tier — sleeps after 15 min idle, first request may take ~30-50s to wake up)

Patient login uses OTP with no real SMS provider wired up — the demo deployment runs with `DEMO_MODE=true`,
which returns the OTP directly in the UI instead of sending it. Doctor login: `anjali.sharma@apex.com` /
`DoctorPass123!`. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for how this is hosted and how to redeploy it.

## Repo structure

```
medeasy/
├── apps/
│   ├── backend/       Node.js + Express + TypeScript + Prisma + PostgreSQL + Socket.IO
│   ├── frontend/      Next.js App Router + Tailwind + Zustand + Socket.IO client
│   └── ml-service/    FastAPI (not yet scaffolded — see apps/ml-service/README.md)
├── docs/              Full product and technical design docs
└── .github/workflows/ CI
```

## Documentation

Read in this order:
1. [`docs/PRD.md`](docs/PRD.md) — product requirements
2. [`docs/system-architecture.md`](docs/system-architecture.md) — high-level system design
3. [`docs/database-schema.md`](docs/database-schema.md) — PostgreSQL schema, ERD, Prisma models
4. [`docs/backend-architecture.md`](docs/backend-architecture.md) — Express/Prisma implementation patterns
5. [`docs/frontend-architecture.md`](docs/frontend-architecture.md) — Next.js App Router design
6. [`docs/ml-architecture.md`](docs/ml-architecture.md) — v2 ML architecture (queue/bed prediction, recommendation, inventory forecasting)

## Current build status

| Module | Status |
|---|---|
| Backend: Auth (OTP / doctor+password / admin+TOTP) | ✅ Implemented (`apps/backend/src/modules/auth`) |
| Backend: Appointments (book/cancel/reschedule/complete, Redis-locked) | ✅ Implemented (`apps/backend/src/modules/appointments`) |
| Backend: Beds (state machine + real-time via Socket.IO) | ✅ Implemented (`apps/backend/src/modules/beds`) |
| Backend: Doctors (search/list) | ✅ Implemented (`apps/backend/src/modules/doctors`) |
| Backend: Real-time doctor queue (`/queue` Socket.IO namespace) | ✅ Implemented (`apps/backend/src/sockets`) |
| Backend: Patient intake (age/illness type/email, `patients` module) | ✅ Implemented (`apps/backend/src/modules/patients`) |
| Backend: Hospital self-registration + manual verification | ✅ Implemented (`apps/backend/src/modules/hospitals`) |
| Backend: Nearest-hospital search (geolocation + illness-specialty match) | ✅ Implemented (`GET /hospitals/nearby`) |
| Backend: Bed admission (patient lookup by phone + allocate) | ✅ Implemented (`apps/backend/src/modules/beds`, `patients/lookup`) |
| Backend: Emergency alerts (real geolocation, nearest-hospital match, live push) | ✅ Implemented (`apps/backend/src/modules/emergencies`) |
| Backend: Inventory | ⬜ Not yet built |
| Frontend: Patient OTP login → complete-profile → doctor search, booking, appointment detail | ✅ Implemented (`apps/frontend/app`) |
| Frontend: Doctor login + live queue view + mark complete | ✅ Implemented (`apps/frontend/app/doctor`) |
| Frontend: Admin login (MFA) + hospital registration | ✅ Implemented (`apps/frontend/app/admin`, `apps/frontend/app/hospital`) |
| Frontend: Admin bed dashboard + admission UI + live emergency alerts | ✅ Implemented (`apps/frontend/app/admin/beds`) |
| Frontend: Hospitals-near-me search + emergency button | ✅ Implemented (`apps/frontend/app/hospitals/near-me`, `components/EmergencyButton.tsx`) |
| ML service | ⬜ Not yet scaffolded (deferred until real usage data exists) |

## Roadmap vs. problem statement

The original problem statement (OPD queuing + bed availability + patient admission, with a
city-wide multi-hospital network) is bigger than a doctor-first booking app, and some of it
(trained ML models, real ambulance-service integration) isn't realistic to build for real in this
project — those stay as described vision, not code. The build order for what *is* real is now
complete, end to end, deployed, and verified against the live production stack:

1. ✅ Patient intake (age, illness type, email) — collected on first login, needed by everything below
2. ✅ Hospital self-registration + verification — mirrors `Doctor.licenseVerified`'s manual-flag pattern, no approval UI
3. ✅ Nearest-hospitals search — real browser geolocation + haversine distance, illness-type filtered against `Doctor.specialty` (a direct lookup, not literal ML)
4. ✅ Bed admission UI — front-desk looks a patient up by phone, then allocates them to a bed; `bed.service.ts`'s state machine (already built) does the rest
5. ✅ Emergency button — real geolocation + a nearest-hospital lookup + a live alert pushed over the existing `/beds` Socket.IO room; no automated ambulance routing

Explicitly out of scope, and left as described vision rather than built: an `Ambulance`
entity/routing, `MedicalRecords` (compliance-heavy), and any literal trained ML model — the
"AI/ML" the original pitch mentions is, honestly, direct specialty-matching and distance
calculation, not a trained model, and the docs and code comments say so rather than overclaiming it.

## Getting started (backend)

```bash
cd apps/backend
npm install
cp .env.example .env       # fill in real secrets
npx prisma migrate dev
npx prisma db seed
npm run dev
```

See [`apps/backend/README.md`](apps/backend/README.md) for endpoint documentation and security notes.

## Getting started (frontend)

```bash
cd apps/frontend
npm install
npm run dev       # expects the backend running locally; see .env.local for NEXT_PUBLIC_API_BASE_URL
```

## Contributing / commit convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, scoped where useful (e.g. `feat(auth):`, `feat(appointments):`). Work in short-lived branches per module and merge via PR, even solo — it keeps history readable.
