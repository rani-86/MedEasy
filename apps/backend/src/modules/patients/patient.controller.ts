import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { PatientService } from './patient.service';
import { ForbiddenError } from '../../common/errors';

const patientService = new PatientService();

export const PatientController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.patientProfileId) {
      throw new ForbiddenError('Only patients have a patient profile');
    }
    const profile = await patientService.getMe(req.user.patientProfileId);
    res.status(200).json({ data: profile });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.patientProfileId) {
      throw new ForbiddenError('Only patients have a patient profile');
    }
    const profile = await patientService.updateMe(req.user.patientProfileId, req.user.sub, req.body);
    res.status(200).json({ data: profile });
  }),
};
