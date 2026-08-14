import { Router } from 'express';
import { DoctorController } from './doctor.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { listDoctorsQuerySchema, doctorIdParamSchema } from './doctor.validation';

const router = Router();

router.use(authenticate);

router.get('/', authorize('patient'), validateRequest(listDoctorsQuerySchema), DoctorController.list);

router.get('/:id', authorize('patient'), validateRequest(doctorIdParamSchema), DoctorController.getById);

export default router;
