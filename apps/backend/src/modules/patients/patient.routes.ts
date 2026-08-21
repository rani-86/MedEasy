import { Router } from 'express';
import { PatientController } from './patient.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize, requireScope } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { updateMySchema, lookupByPhoneSchema } from './patient.validation';

const router = Router();

router.use(authenticate);

router.get('/me', authorize('patient'), PatientController.getMe);

router.patch('/me', authorize('patient'), validateRequest(updateMySchema), PatientController.updateMe);

// Same scope the beds admission endpoints require — a hospital's front desk looking up a
// patient is part of the same admission workflow, gated the same way.
router.get(
  '/lookup',
  authorize('admin'),
  requireScope('admin:beds'),
  validateRequest(lookupByPhoneSchema),
  PatientController.lookupByPhone,
);

export default router;
