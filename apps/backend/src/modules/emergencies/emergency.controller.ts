import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { EmergencyService } from './emergency.service';
import { ForbiddenError } from '../../common/errors';

const emergencyService = new EmergencyService();

export const EmergencyController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.patientProfileId) {
      throw new ForbiddenError('Only patients can raise an emergency request');
    }
    const result = await emergencyService.create(req.user.patientProfileId, req.body);
    res.status(201).json({ data: result });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.hospitalId) {
      throw new ForbiddenError('Your account is not scoped to a hospital');
    }
    const result = await emergencyService.listForHospital(req.user.hospitalId);
    res.status(200).json({ data: result });
  }),

  acknowledge: asyncHandler(async (req: Request, res: Response) => {
    const result = await emergencyService.acknowledge(req.params.id, req.user!);
    res.status(200).json({ data: result });
  }),
};
