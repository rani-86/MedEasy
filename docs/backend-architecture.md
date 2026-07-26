# Medeasy — Backend Architecture (Node.js + Express + TypeScript + Prisma)

**Version:** 1.0
**Companion to:** Medeasy PRD, System Architecture, and PostgreSQL Schema docs
**Status:** Draft for Engineering Review
**Date:** July 2026

> This document specifies the implementation architecture for a single Medeasy backend service (pattern applies uniformly across the Appointment, Bed, Inventory, and other domain services described in the System Architecture doc). Code samples use the Appointment Service as the running example since it touches the most cross-cutting concerns (locking, events, sockets).

---

## 1. Folder Structure

```
medeasy-backend/
├── src/
│   ├── config/
│   │   ├── env.ts                 # validated environment variables
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── redis.ts               # Redis client singleton
│   │   └── logger.ts              # Winston/Pino logger config
│   │
│   ├── modules/
│   │   ├── appointments/
│   │   │   ├── appointment.controller.ts
│   │   │   ├── appointment.service.ts
│   │   │   ├── appointment.routes.ts
│   │   │   ├── appointment.validation.ts
│   │   │   ├── appointment.types.ts
│   │   │   └── appointment.events.ts   # publishes to event bus
│   │   ├── beds/
│   │   │   ├── bed.controller.ts
│   │   │   ├── bed.service.ts
│   │   │   ├── bed.routes.ts
│   │   │   └── bed.validation.ts
│   │   ├── doctors/
│   │   ├── patients/
│   │   ├── inventory/
│   │   ├── prescriptions/
│   │   └── auth/
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       ├── auth.routes.ts
│   │       ├── auth.validation.ts
│   │       └── otp.service.ts
│   │
│   ├── middleware/
│   │   ├── authenticate.ts        # JWT verification
│   │   ├── authorize.ts           # RBAC/scope checks
│   │   ├── validateRequest.ts     # Zod schema validation wrapper
│   │   ├── rateLimiter.ts
│   │   ├── errorHandler.ts        # centralized error handler
│   │   ├── requestLogger.ts
│   │   └── asyncHandler.ts        # wraps async controllers
│   │
│   ├── sockets/
│   │   ├── index.ts               # Socket.IO server bootstrap
│   │   ├── queue.namespace.ts
│   │   ├── beds.namespace.ts
│   │   └── auth.socket.ts         # socket handshake auth
│   │
│   ├── events/
│   │   ├── eventBus.ts            # Kafka/RabbitMQ producer/consumer wrapper
│   │   ├── publishers/
│   │   └── consumers/
│   │
│   ├── common/
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   ├── NotFoundError.ts
│   │   │   ├── ValidationError.ts
│   │   │   ├── ConflictError.ts
│   │   │   └── UnauthorizedError.ts
│   │   ├── utils/
│   │   │   ├── locks.ts           # Redis distributed lock helper
│   │   │   └── pagination.ts
│   │   └── constants.ts
│   │
│   ├── app.ts                     # Express app assembly
│   └── server.ts                  # HTTP + Socket.IO server bootstrap
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env.example
├── tsconfig.json
├── package.json
└── Dockerfile
```

**Rationale:** Feature-first (`modules/appointments`, `modules/beds`) rather than layer-first (`controllers/`, `services/` at the root) — each module is self-contained and independently extractable into its own microservice later, matching the System Architecture doc's service boundaries.

---

## 2. Controllers

Controllers handle HTTP concerns only — input extraction, calling the service, shaping the response. No business logic.

```typescript
// src/modules/appointments/appointment.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppointmentService } from './appointment.service';

const appointmentService = new AppointmentService();

export const AppointmentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const patientId = req.user!.patientProfileId;
    const appointment = await appointmentService.bookAppointment({
      patientId,
      doctorId: req.body.doctorId,
      slotStart: req.body.slotStart,
    });
    res.status(201).json({ data: appointment });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentService.getById(req.params.id, req.user!);
    res.status(200).json({ data: appointment });
  }),

  listForPatient: asyncHandler(async (req: Request, res: Response) => {
    const patientId = req.user!.patientProfileId;
    const { page = '1', limit = '20' } = req.query;
    const result = await appointmentService.listForPatient(patientId, Number(page), Number(limit));
    res.status(200).json(result);
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    await appointmentService.cancel(req.params.id, req.user!);
    res.status(204).send();
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const updated = await appointmentService.reschedule(
      req.params.id,
      req.body.newSlotStart,
      req.user!,
    );
    res.status(200).json({ data: updated });
  }),
};
```

**Key convention:** every controller method is wrapped in `asyncHandler` so thrown errors (including rejected promises) flow into the centralized error middleware rather than requiring try/catch in every handler.

---

## 3. Services

Services hold business logic, orchestrate the Prisma client, apply locks, and publish events. Controllers never touch Prisma directly.

```typescript
// src/modules/appointments/appointment.service.ts
import { prisma } from '../../config/db';
import { acquireLock, releaseLock } from '../../common/utils/locks';
import { ConflictError, NotFoundError, ForbiddenError } from '../../common/errors';
import { publishEvent } from '../../events/eventBus';
import { AuthUser } from '../auth/auth.types';

interface BookAppointmentInput {
  patientId: string;
  doctorId: string;
  slotStart: string; // ISO timestamp
}

export class AppointmentService {
  async bookAppointment(input: BookAppointmentInput) {
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: input.doctorId } });
    if (!doctor.licenseVerified) {
      throw new ConflictError('Doctor is not yet verified and cannot accept bookings');
    }

    const slotStart = new Date(input.slotStart);
    const slotEnd = new Date(slotStart.getTime() + doctor.avgConsultMinutes * 60_000);

    const lockKey = `lock:slot:${input.doctorId}:${slotStart.toISOString()}`;
    const lock = await acquireLock(lockKey, 10_000); // 10s TTL
    if (!lock) {
      throw new ConflictError('This slot is currently being booked by another patient, please retry');
    }

    try {
      const existing = await prisma.appointment.findFirst({
        where: { doctorId: input.doctorId, slotStart, status: 'booked' },
      });
      if (existing) {
        throw new ConflictError('This slot has just been booked. Please choose another.');
      }

      const appointment = await prisma.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          hospitalId: doctor.hospitalId,
          slotStart,
          slotEnd,
          status: 'booked',
        },
      });

      await publishEvent('AppointmentBooked', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        hospitalId: appointment.hospitalId,
        patientId: appointment.patientId,
        slotStart: appointment.slotStart,
      });

      return appointment;
    } finally {
      await releaseLock(lockKey, lock);
    }
  }

  async getById(id: string, user: AuthUser) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundError('Appointment not found');
    this.assertAccess(appointment, user);
    return appointment;
  }

  async listForPatient(patientId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId },
        orderBy: { slotStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where: { patientId } }),
    ]);
    return { data: items, meta: { page, limit, total } };
  }

  async cancel(id: string, user: AuthUser) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundError('Appointment not found');
    this.assertAccess(appointment, user);

    await prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } });
    await publishEvent('AppointmentCancelled', { appointmentId: id, doctorId: appointment.doctorId });
  }

  async reschedule(id: string, newSlotStartRaw: string, user: AuthUser) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundError('Appointment not found');
    this.assertAccess(appointment, user);

    // Cancel + rebook atomically as a transaction to avoid orphaned slots
    const newSlotStart = new Date(newSlotStartRaw);
    return prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id }, data: { status: 'cancelled' } });
      return tx.appointment.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          hospitalId: appointment.hospitalId,
          slotStart: newSlotStart,
          slotEnd: new Date(newSlotStart.getTime() + 20 * 60_000),
          status: 'booked',
        },
      });
    });
  }

  private assertAccess(appointment: { patientId: string }, user: AuthUser) {
    if (user.role === 'patient' && appointment.patientId !== user.patientProfileId) {
      throw new ForbiddenError('You do not have access to this appointment');
    }
  }
}
```

---

## 4. Middleware

```typescript
// src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../common/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
```

```typescript
// src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}

export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.scopes?.includes(scope)) {
      return next(new ForbiddenError(`Missing required scope: ${scope}`));
    }
    next();
  };
}
```

```typescript
// src/middleware/validateRequest.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../common/errors';

export function validateRequest(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))));
      }
      next(err);
    }
  };
}
```

```typescript
// src/middleware/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler =
  (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
```

```typescript
// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';

export const apiRateLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) }),
  windowMs: 60_000,
  max: 100, // 100 requests/min per IP; tighter limits applied per-route for booking endpoints
  standardHeaders: true,
  legacyHeaders: false,
});

export const bookingRateLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) }),
  windowMs: 60_000,
  max: 10, // stricter limit on booking-mutation endpoints to prevent slot-hoarding abuse
});
```

**Middleware order (applied in `app.ts`):** `requestLogger` → `helmet`/CORS → `apiRateLimiter` → body parser → route-level `authenticate` → `authorize`/`requireScope` → `validateRequest` → controller → `errorHandler` (last, registered after all routes).

---

## 5. API Routes

```typescript
// src/modules/appointments/appointment.routes.ts
import { Router } from 'express';
import { AppointmentController } from './appointment.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { bookingRateLimiter } from '../../middleware/rateLimiter';
import { createAppointmentSchema, rescheduleAppointmentSchema } from './appointment.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('patient'),
  bookingRateLimiter,
  validateRequest(createAppointmentSchema),
  AppointmentController.create,
);

router.get('/:id', AppointmentController.getById);

router.get('/', authorize('patient'), AppointmentController.listForPatient);

router.patch(
  '/:id/cancel',
  authorize('patient', 'admin'),
  AppointmentController.cancel,
);

router.patch(
  '/:id/reschedule',
  authorize('patient'),
  validateRequest(rescheduleAppointmentSchema),
  AppointmentController.reschedule,
);

export default router;
```

```typescript
// src/app.ts (route mounting)
import express from 'express';
import appointmentRoutes from './modules/appointments/appointment.routes';
import bedRoutes from './modules/beds/bed.routes';
import authRoutes from './modules/auth/auth.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRateLimiter } from './middleware/rateLimiter';
import helmet from 'helmet';
import cors from 'cors';

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
app.use(express.json());
app.use(requestLogger);
app.use(apiRateLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/beds', bedRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// Must be registered LAST — after all routes
app.use(errorHandler);
```

### Route Summary

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/otp/request` | public | Request OTP for patient login |
| POST | `/api/v1/auth/otp/verify` | public | Verify OTP, issue tokens |
| POST | `/api/v1/auth/login` | public | Doctor/Admin credential login |
| POST | `/api/v1/auth/refresh` | authenticated | Rotate access token |
| POST | `/api/v1/appointments` | patient | Book appointment |
| GET | `/api/v1/appointments/:id` | patient/doctor/admin | Get appointment detail |
| GET | `/api/v1/appointments` | patient | List own appointments |
| PATCH | `/api/v1/appointments/:id/cancel` | patient/admin | Cancel appointment |
| PATCH | `/api/v1/appointments/:id/reschedule` | patient | Reschedule appointment |
| GET | `/api/v1/beds` | admin | List hospital beds + live status |
| PATCH | `/api/v1/beds/:id/allocate` | admin | Allocate bed to patient |
| PATCH | `/api/v1/beds/:id/discharge` | admin | Discharge + free bed |
| GET | `/api/v1/inventory` | admin | List inventory items |
| POST | `/api/v1/inventory/:id/reorder` | admin | Trigger manual reorder / PO |

---

## 6. Validation

Zod is used for schema validation — types are inferred directly from schemas, keeping DTOs and validation in sync.

```typescript
// src/modules/appointments/appointment.validation.ts
import { z } from 'zod';

export const createAppointmentSchema = z.object({
  body: z.object({
    doctorId: z.string().uuid('doctorId must be a valid UUID'),
    slotStart: z.string().datetime({ message: 'slotStart must be an ISO 8601 timestamp' })
      .refine((val) => new Date(val) > new Date(), {
        message: 'slotStart must be in the future',
      }),
  }),
});

export const rescheduleAppointmentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    newSlotStart: z.string().datetime()
      .refine((val) => new Date(val) > new Date(), {
        message: 'newSlotStart must be in the future',
      }),
  }),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>['body'];
```

```typescript
// src/modules/auth/auth.validation.ts
import { z } from 'zod';

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian phone number'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+91[6-9]\d{9}$/),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),
});

export const doctorLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});
```

**Convention:** every route that accepts a body, query, or param goes through `validateRequest(schema)` before hitting the controller — no controller trusts raw `req.body`.

---

## 7. Error Handling

```typescript
// src/common/errors/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Validation failed', 422, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with current state') {
    super(message, 409, 'CONFLICT');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}
```

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/AppError';
import { logger } from '../config/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err);
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
    }
  }

  logger.error('Unhandled error', { err, path: req.path });
  return res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong. Please try again.' },
  });
}
```

**Conventions:**
- Every error response follows the same envelope: `{ error: { code, message, details? } }` — clients branch on `code`, not on message text (which may change).
- Operational errors (`AppError` subclasses) are expected and logged at `warn`/no-op; unexpected errors are logged at `error` with full stack traces, and never leak internal details (stack traces, SQL, file paths) to the client response.
- Prisma-specific errors are translated into domain-appropriate HTTP codes at the boundary, so services never need to know about Prisma error codes.

---

## 8. Authentication

```typescript
// src/modules/auth/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { prisma } from '../../config/db';
import { redisClient } from '../../config/redis';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../common/errors';
import { OtpService } from './otp.service';

const otpService = new OtpService();

export class AuthService {
  async requestOtp(phone: string) {
    const code = await otpService.generateAndSend(phone);
    return { message: 'OTP sent', expiresInSeconds: 300 };
  }

  async verifyOtp(phone: string, otp: string) {
    const valid = await otpService.verify(phone, otp);
    if (!valid) throw new UnauthorizedError('Invalid or expired OTP');

    let user = await prisma.user.findUnique({ where: { phone }, include: { patientProfile: true } });
    if (!user) {
      user = await prisma.user.create({
        data: { role: 'patient', phone, name: 'New Patient', patientProfile: { create: {} } },
        include: { patientProfile: true },
      });
    }
    return this.issueTokens(user.id, 'patient', { patientProfileId: user.patientProfile!.id });
  }

  async doctorLogin(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email }, include: { doctor: true } });
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const scopes = user.doctor?.licenseVerified
      ? ['appointments:read', 'appointments:write', 'prescriptions:write']
      : ['onboarding:read']; // restricted scope until license verified

    return this.issueTokens(user.id, 'doctor', {
      doctorId: user.doctor!.id,
      hospitalId: user.doctor!.hospitalId,
      scopes,
    });
  }

  async refresh(refreshToken: string) {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; jti: string };
    const storedJti = await redisClient.get(`refresh:${payload.sub}`);
    if (storedJti !== payload.jti) {
      throw new UnauthorizedError('Refresh token has been revoked or is invalid');
    }
    // rotate: invalidate old, issue new
    await redisClient.del(`refresh:${payload.sub}`);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens(user.id, user.role, {});
  }

  private async issueTokens(userId: string, role: string, extraClaims: Record<string, unknown>) {
    const accessToken = jwt.sign({ sub: userId, role, ...extraClaims }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const jti = randomUUID();
    const refreshToken = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    await redisClient.set(`refresh:${userId}`, jti, 'EX', 60 * 60 * 24 * 30);

    return { accessToken, refreshToken };
  }
}
```

**Design points (matching the earlier Authentication Design doc):**
- Patients authenticate via OTP; a `patient_profiles` row and `users` row are created together on first successful verification.
- Doctors log in via credentials; an unverified license yields a **restricted-scope token** (`onboarding:read` only) rather than a rejected login — they can view onboarding status but not touch patient data.
- Refresh tokens are single-use and rotated: the `jti` stored in Redis is deleted and replaced on every refresh, so a stolen refresh token becomes useless after its first use by the legitimate client.
- Hospital Admin login (not shown, same pattern) additionally requires a TOTP MFA step before `issueTokens` is called.

---

## 9. Socket.IO Integration

```typescript
// src/sockets/index.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient, redisSubClient } from '../config/redis';
import { socketAuthMiddleware } from './auth.socket';
import { registerQueueNamespace } from './queue.namespace';
import { registerBedsNamespace } from './beds.namespace';

export function initSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') },
    adapter: createAdapter(redisClient, redisSubClient), // fan-out across horizontally scaled nodes
  });

  io.use(socketAuthMiddleware);

  registerQueueNamespace(io);
  registerBedsNamespace(io);

  return io;
}
```

```typescript
// src/sockets/auth.socket.ts
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Missing auth token'));
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
```

```typescript
// src/sockets/queue.namespace.ts
import { Server } from 'socket.io';

export function registerQueueNamespace(io: Server) {
  const nsp = io.of('/queue');

  nsp.on('connection', (socket) => {
    const { user } = socket.data;

    socket.on('subscribe:doctor', (payload: { doctorId: string; date: string }) => {
      socket.join(`doctor:${payload.doctorId}:${payload.date}`);
    });

    socket.on('subscribe:self', () => {
      if (user.role === 'patient') socket.join(`patient:${user.patientProfileId}`);
    });

    socket.on('disconnect', () => {
      // rooms are auto-cleaned by Socket.IO on disconnect
    });
  });
}

// Called by the Queue Prediction event consumer when it recomputes ETAs
export function emitQueuePositionUpdate(
  io: Server,
  patientId: string,
  payload: { appointmentId: string; position: number; etaMinutes: number },
) {
  io.of('/queue').to(`patient:${patientId}`).emit('queue:position_update', payload);
  if (payload.position <= 2) {
    io.of('/queue').to(`patient:${patientId}`).emit('queue:your_turn_soon', payload);
  }
}
```

```typescript
// src/sockets/beds.namespace.ts
import { Server } from 'socket.io';

export function registerBedsNamespace(io: Server) {
  const nsp = io.of('/beds');

  nsp.on('connection', (socket) => {
    const { user } = socket.data;
    if (user.role !== 'admin') {
      socket.disconnect(true); // beds namespace is admin-only
      return;
    }
    socket.join(`hospital:${user.hospitalId}`);
  });
}

// Called by the Bed Service after a successful allocation/discharge/status change
export function emitBedStatusChanged(
  io: Server,
  hospitalId: string,
  payload: { bedId: string; category: string; status: string },
) {
  io.of('/beds').to(`hospital:${hospitalId}`).emit('bed:status_changed', payload);
}
```

```typescript
// src/server.ts — bootstrap
import http from 'http';
import { app } from './app';
import { initSocketServer } from './sockets';
import { startEventConsumers } from './events/consumers';
import { logger } from './config/logger';
import { env } from './config/env';

const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

// Event consumers (e.g. AppointmentCompleted → recompute queue ETA → emit socket event)
// are given the `io` instance so they can push real-time updates after processing.
startEventConsumers(io);

httpServer.listen(env.PORT, () => {
  logger.info(`Medeasy backend listening on port ${env.PORT}`);
});
```

**Key integration points:**
- Socket auth reuses the same JWT used for REST — no separate socket-specific login flow.
- The Redis adapter (`@socket.io/redis-adapter`) is what makes `emitQueuePositionUpdate` and `emitBedStatusChanged` work correctly across multiple horizontally-scaled Node instances — an event consumed on Node A can emit to a socket connected on Node B.
- Real-time emitters (`emitQueuePositionUpdate`, `emitBedStatusChanged`) are called from **event consumers**, not from controllers — this keeps the HTTP request/response cycle fast and decouples "the booking succeeded" from "everyone who cares has been notified," matching the event-driven backbone in the System Architecture doc.
- The `/beds` namespace disconnects any non-admin socket immediately — bed status is hospital-operational data, not patient-facing in real time (patients see availability via the Recommendation Service's REST API instead).

---

*End of Document*
