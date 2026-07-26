# Medeasy Frontend (Next.js)

**Status: not yet scaffolded.**

The architecture for this app is fully specified in [`docs/frontend-architecture.md`](../../docs/frontend-architecture.md) — App Router structure, pages, components, state management, API integration, auth flow, dashboard design, and responsive layout.

## To scaffold this app

```bash
cd apps
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir=false
cd frontend
npm install @tanstack/react-query zustand axios socket.io-client react-hook-form zod
npx shadcn@latest init
```

Then build out the route groups and modules per the architecture doc:
- `(auth)`, `(patient)`, `(doctor)`, `(admin)` route groups
- `lib/api/`, `lib/stores/`, `lib/socket/`, `lib/auth/` per Sections 4–6
