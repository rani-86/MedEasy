# Medeasy

A multi-sided healthcare platform connecting patients, doctors, and hospital administrators — appointment booking, hospital discovery, live bed/queue visibility, and hospital operations (inventory, analytics).

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
| Backend: Inventory | ⬜ Not yet built |
| Frontend: Patient OTP login, doctor search, booking, appointment detail | ✅ Implemented (`apps/frontend/app`) |
| Frontend: Doctor login + live queue view | ✅ Implemented (`apps/frontend/app/doctor`) |
| Frontend: Admin/bed views | ⬜ Not yet built |
| ML service | ⬜ Not yet scaffolded (deferred until real usage data exists) |

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
