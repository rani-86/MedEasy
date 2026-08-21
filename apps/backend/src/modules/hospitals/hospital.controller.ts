import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { HospitalService } from './hospital.service';

const hospitalService = new HospitalService();

export const HospitalController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await hospitalService.register(req.body);
    res.status(201).json({ data: result });
  }),

  nearby: asyncHandler(async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const illnessType = typeof req.query.illnessType === 'string' ? req.query.illnessType : undefined;
    const result = await hospitalService.findNearby({ lat, lng, illnessType });
    res.status(200).json({ data: result });
  }),
};
