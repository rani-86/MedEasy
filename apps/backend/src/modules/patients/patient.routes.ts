import { Router } from 'express';
import { PatientController } from './patient.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { updateMySchema } from './patient.validation';

const router = Router();

router.use(authenticate);

router.get('/me', authorize('patient'), PatientController.getMe);

router.patch('/me', authorize('patient'), validateRequest(updateMySchema), PatientController.updateMe);

export default router;
