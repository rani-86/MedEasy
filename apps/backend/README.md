# Medeasy — Authentication Module

Production-ready authentication service for Medeasy, built with Node.js, Express, TypeScript, Prisma, and PostgreSQL. Implements the design specified in the Medeasy Backend Architecture doc: OTP login for patients, credential login for doctors (license-gated scopes), credential + TOTP MFA login for hospital admins, and rotating refresh tokens.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- Redis (OTP storage, refresh-token store, rate-limit store)
- Zod (request validation)
- jsonwebtoken (JWT access/refresh tokens)
- bcrypt (password hashing)
- otplib (admin TOTP/MFA verification)

## Setup

```bash
npm install
cp .env.example .env    # fill in real secrets before running
npx prisma migrate dev  # creates users / patient_profiles / doctors tables
npx prisma db seed      # seeds a sample doctor + admin user
npm run dev             # starts on http://localhost:4000
```

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/otp/request` | public | Request an OTP for a patient phone number |
| POST | `/api/v1/auth/otp/verify` | public | Verify OTP, creates the patient account on first login, returns tokens |
| POST | `/api/v1/auth/login/doctor` | public | Doctor email+password login |
| POST | `/api/v1/auth/login/admin` | public | Admin email+password+TOTP login |
| POST | `/api/v1/auth/refresh` | public (cookie or body) | Rotate access token using the refresh token |
| POST | `/api/v1/auth/logout` | Bearer | Revoke the current refresh token |
| GET | `/api/v1/auth/me` | Bearer | Return the decoded token claims for the current session |
| POST | `/api/v1/auth/change-password` | Bearer | Change password (doctor/admin only) |
| GET | `/health` | public | Liveness probe |

## Security notes
- Refresh tokens are set as `httpOnly`, `Secure` (in production), `SameSite=Strict` cookies — never exposed to client JS.
- Refresh tokens are **single-use and rotated**: each refresh invalidates the previous token's `jti` in Redis, so a stolen-but-already-used refresh token is immediately worthless.
- OTP verification is attempt-limited (`OTP_MAX_ATTEMPTS`, default 5) and the OTP itself is single-use, deleted from Redis on successful verification.
- All mutating auth endpoints (`otp/request`, `otp/verify`, `login/*`) are behind Redis-backed rate limiters, keyed by phone/email+IP rather than IP alone, to resist both distributed and single-source abuse.
- Doctors with an unverified license still receive a valid token, but scoped to `onboarding:read` only — enforced via `requireScope` in downstream services, not by blocking login outright.
- Passwords are hashed with bcrypt at 12 rounds; changing a password revokes the existing refresh token, forcing re-login everywhere else.

## Not included in this module (see other Medeasy backend modules)
- Doctor/Admin account creation (onboarding) — owned by the Hospital Admin Portal module, which calls `hashPassword()` exported from `auth.service.ts` when creating a new doctor/admin user.
- Admin TOTP secret provisioning (`admin:totp_secret:{userId}` in Redis) — belongs to an MFA-setup flow in the Admin Portal module; this module only verifies an already-provisioned secret.
- Real SMS provider integration — `otp.service.ts` has a clearly marked integration point; wire up your provider (MSG91, Twilio, etc.) there.

## A note on verification in this environment
This code was written and reviewed carefully for correctness against the documented package APIs (Prisma, ioredis, express-rate-limit v7 + rate-limit-redis v4, otplib, otp-generator), but could not be run through a live `npm install` + `tsc` + integration test in this sandbox, since outbound network access is disabled here. Before deploying, run `npm install && npm run build` and the Prisma migration locally to confirm a clean compile in your environment.
