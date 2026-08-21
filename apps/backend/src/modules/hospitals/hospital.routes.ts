import { Router } from 'express';
import { HospitalController } from './hospital.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { loginRateLimiter } from '../../middleware/rateLimiter';
import { registerHospitalSchema } from './hospital.validation';

const router = Router();

// Public — a hospital registering itself has no account yet to authenticate with.
router.post(
  '/register',
  loginRateLimiter,
  validateRequest(registerHospitalSchema),
  HospitalController.register,
);

export default router;
