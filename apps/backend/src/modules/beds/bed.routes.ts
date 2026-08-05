import { Router } from 'express';
import { BedController } from './bed.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize, requireScope } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { bedIdParamSchema, allocateBedSchema, listBedsQuerySchema } from './bed.validation';

const router = Router();

router.use(authenticate, authorize('admin'), requireScope('admin:beds'));

router.get('/', validateRequest(listBedsQuerySchema), BedController.list);
router.get('/:id', validateRequest(bedIdParamSchema), BedController.getById);

router.patch('/:id/allocate', validateRequest(allocateBedSchema), BedController.allocate);
router.patch('/:id/reserve', validateRequest(bedIdParamSchema), BedController.reserve);
router.patch('/:id/cancel-reservation', validateRequest(bedIdParamSchema), BedController.cancelReservation);
router.patch('/:id/discharge', validateRequest(bedIdParamSchema), BedController.discharge);
router.patch('/:id/mark-cleaned', validateRequest(bedIdParamSchema), BedController.markCleaned);

export default router;