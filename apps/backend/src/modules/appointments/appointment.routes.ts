import { Router } from 'express';
import { AppointmentController } from './appointment.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize, requireScope } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { bookingRateLimiter } from '../../middleware/rateLimiter';
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
} from './appointment.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('patient'),
  bookingRateLimiter,
  validateRequest(createAppointmentSchema),
  AppointmentController.create,
);

router.get(
  '/',
  authorize('patient'),
  validateRequest(listAppointmentsQuerySchema),
  AppointmentController.listForPatient,
);

router.get(
  '/queue/today',
  authorize('doctor'),
  requireScope('appointments:read'),
  AppointmentController.listForDoctor,
);

router.get(
  '/:id',
  authorize('patient', 'doctor', 'admin'),
  validateRequest(appointmentIdParamSchema),
  AppointmentController.getById,
);

router.patch(
  '/:id/cancel',
  authorize('patient', 'admin'),
  validateRequest(appointmentIdParamSchema),
  AppointmentController.cancel,
);

router.patch(
  '/:id/complete',
  authorize('doctor'),
  requireScope('appointments:write'),
  validateRequest(appointmentIdParamSchema),
  AppointmentController.complete,
);

router.patch(
  '/:id/reschedule',
  authorize('patient'),
  bookingRateLimiter,
  validateRequest(rescheduleAppointmentSchema),
  AppointmentController.reschedule,
);

export default router;