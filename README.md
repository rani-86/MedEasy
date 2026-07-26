# Medeasy

A multi-sided healthcare platform connecting patients, doctors, and hospital administrators — appointment booking, hospital discovery, live bed/queue visibility, and hospital operations (inventory, analytics).

## Repo structure

```
medeasy/
├── apps/
│   ├── backend/       Node.js + Express + TypeScript + Prisma + PostgreSQL
│   ├── frontend/      Next.js (not yet scaffolded — see apps/frontend/README.md)
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
| Backend: Auth | ✅ Implemented (`apps/backend/src/modules/auth`) |
| Backend: Appointments | ⬜ Not yet built |
| Backend: Beds | ⬜ Not yet built |
| Backend: Inventory | ⬜ Not yet built |
| Backend: Doctors/Hospitals | ⬜ Not yet built |
| Frontend | ⬜ Not yet scaffolded |
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

## Contributing / commit convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, scoped where useful (e.g. `feat(auth):`, `feat(appointments):`). Work in short-lived branches per module and merge via PR, even solo — it keeps history readable.
