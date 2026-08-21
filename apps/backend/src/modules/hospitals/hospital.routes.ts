import { Router } from 'express';
import { HospitalController } from './hospital.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { loginRateLimiter } from '../../middleware/rateLimiter';
import { registerHospitalSchema, nearbyHospitalsQuerySchema } from './hospital.validation';

const router = Router();

// Public — a hospital registering itself has no account yet to authenticate with.
router.post(
  '/register',
  loginRateLimiter,
  validateRequest(registerHospitalSchema),
  HospitalController.register,
);

router.get(
  '/nearby',
  authenticate,
  authorize('patient'),
  validateRequest(nearbyHospitalsQuerySchema),
  HospitalController.nearby,
);

export default router;
