import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { DoctorService } from './doctor.service';

const doctorService = new DoctorService();

export const DoctorController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : undefined;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await doctorService.list(search, specialty, page, limit);
    res.status(200).json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const doctor = await doctorService.getById(req.params.id);
    res.status(200).json({ data: doctor });
  }),
};
