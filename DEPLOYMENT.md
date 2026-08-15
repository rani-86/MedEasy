# Deploying MedEasy (free-tier demo)

This is a step-by-step runbook for hosting a live demo of MedEasy for a portfolio/resume link.
Stack: **Vercel** (frontend) + **Render** (backend, Node + Socket.IO) + **Neon** (Postgres) + **Upstash** (Redis).

All four have a free tier. You'll need your own accounts on each — none of this can be done on your
behalf, since it requires account creation and credentials only you should hold.

Why this combination and not something simpler:
- The backend needs a long-running process (Socket.IO needs persistent WebSocket connections), which
  rules out pure-serverless platforms for it — Render's free web service supports WebSockets.
- Render's free Postgres auto-deletes after 30 days, which is bad for a demo you want to stay live —
  Neon's free Postgres doesn't expire.
- Railway no longer has a free tier (paid-only now), so it's skipped even though it's a good fit
  otherwise.

## 1. Database — Neon (Postgres)

1. Sign up at [neon.tech](https://neon.tech).
2. Create a new project.
3. Copy the connection string it gives you (it already includes `sslmode=require` — use it as-is).
4. Save it — this is your `DATABASE_URL`.

## 2. Redis — Upstash

1. Sign up at [upstash.com](https://upstash.com).
2. Create a new Redis database (free tier). Pick a region close to wherever you'll deploy the backend
   (e.g. same continent as Render's region) to keep latency low.
3. Copy the `rediss://` connection string (TLS) from the dashboard.
4. Save it — this is your `REDIS_URL`.
5. Note: the free tier caps daily commands (~10k/day at time of writing). Fine for demo traffic, not
   for real usage.

## 3. Backend — Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account/repo.
2. **New → Web Service**, select the MedEasy repo.
3. Configure:
   - **Root Directory:** `apps/backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm start`
   - **Instance Type:** Free
4. Environment variables (Render dashboard → Environment):
   - `NODE_ENV=production`
   - `DATABASE_URL` — from step 1
   - `REDIS_URL` — from step 2
   - `JWT_ACCESS_SECRET` — generate locally, don't reuse the dev value:
     ```bash
     openssl rand -base64 48
     ```
   - `JWT_REFRESH_SECRET` — generate a **different** random string the same way
   - `JWT_ACCESS_EXPIRY=15m`
   - `JWT_REFRESH_EXPIRY_DAYS=30`
   - `DEMO_MODE=true` — no SMS provider is wired up, so this makes the OTP request endpoint return
     the code directly in the response; the frontend already displays it with a "demo mode" label.
   - `ALLOWED_ORIGINS` — leave any placeholder for now (e.g. `http://localhost:3000`); you'll update
     this in step 5 once you have the real Vercel URL.
5. Deploy. First deploy will run the Prisma migration against Neon automatically (via the start command).
6. Once it's live, open the **Shell** tab for the service (in Render's dashboard) and run once:
   ```bash
   npx prisma db seed
   ```
   This creates the demo hospital, doctor (`anjali.sharma@apex.com` / `DoctorPass123!`), patient, and
   beds used by the app.
7. Note the free-tier caveat: the service sleeps after 15 minutes of inactivity. The first request after
   that takes ~30–50s to wake back up — expected, not a bug.

## 4. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) and import the MedEasy repo.
2. Configure:
   - **Root Directory:** `apps/frontend`
   - Framework preset: Next.js (auto-detected)
3. Environment variable:
   - `NEXT_PUBLIC_API_BASE_URL = https://<your-render-service>.onrender.com/api/v1`
4. Deploy. Vercel will give you a URL like `https://medeasy-xyz.vercel.app`.

## 5. Close the loop on CORS

Go back to Render → Environment → `ALLOWED_ORIGINS`, set it to your **exact** Vercel URL (no trailing
slash), and redeploy the backend. Until you do this, the browser will block API calls from the
frontend with a CORS error.

## Verifying it worked

- Visit the Vercel URL. Patient login (`/`): enter any `+91XXXXXXXXXX` number, request OTP — with
  `DEMO_MODE=true` the code appears directly on the page.
- Doctor login (`/doctor/login`): `anjali.sharma@apex.com` / `DoctorPass123!`.
- Book an appointment as the patient, then check `/doctor/queue` as the doctor (in a second
  browser/incognito window) — it should update live via the `/queue` Socket.IO namespace without a
  refresh.

## Troubleshooting

- **Login "succeeds" but immediately looks logged out on refresh** — check that `ALLOWED_ORIGINS`
  exactly matches the Vercel URL (scheme + host, no trailing slash) and that the Render service
  redeployed after you set it.
- **CORS errors in the browser console** — same as above; also double check `NEXT_PUBLIC_API_BASE_URL`
  on Vercel doesn't have a typo or a trailing slash mismatch with what the backend expects.
- **Socket.IO doesn't connect on the queue page** — the `/queue` namespace lives on the same origin as
  the API (derived from `NEXT_PUBLIC_API_BASE_URL`), so this is usually the same CORS/origin
  misconfiguration as above.
- **500s on any request right after a fresh deploy** — check Render's logs; likely the migration
  hadn't finished or the seed hasn't been run yet.
