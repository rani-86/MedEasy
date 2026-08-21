import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { HospitalService } from './hospital.service';

const hospitalService = new HospitalService();

export const HospitalController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await hospitalService.register(req.body);
    res.status(201).json({ data: result });
  }),
};
