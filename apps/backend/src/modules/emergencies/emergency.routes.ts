import { Router } from 'express';
import { EmergencyController } from './emergency.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize, requireScope } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { createEmergencySchema, emergencyIdParamSchema } from './emergency.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorize('patient'), validateRequest(createEmergencySchema), EmergencyController.create);

router.get('/', authorize('admin'), requireScope('admin:beds'), EmergencyController.list);

router.patch(
  '/:id/acknowledge',
  authorize('admin'),
  requireScope('admin:beds'),
  validateRequest(emergencyIdParamSchema),
  EmergencyController.acknowledge,
);

export default router;
