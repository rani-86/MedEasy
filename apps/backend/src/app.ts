import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import appointmentRoutes from './modules/appointments/appointment.routes';
import bedRoutes from './modules/beds/bed.routes';
import doctorRoutes from './modules/doctors/doctor.routes';
import patientRoutes from './modules/patients/patient.routes';
import hospitalRoutes from './modules/hospitals/hospital.routes';
import emergencyRoutes from './modules/emergencies/emergency.routes';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true, // required so the browser sends/receives the httpOnly refresh cookie
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(apiRateLimiter);

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/beds', bedRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/hospitals', hospitalRoutes);
  app.use('/api/v1/emergencies', emergencyRoutes);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
  });

  // Must be registered LAST, after all routes.
  app.use(errorHandler);

  return app;
}
