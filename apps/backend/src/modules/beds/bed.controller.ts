import { Request, Response } from 'express';
import { BedCategory, BedStatus } from '@prisma/client';
import { asyncHandler } from '../../middleware/asyncHandler';
import { BedService } from './bed.service';
import { ForbiddenError } from '../../common/errors';

const bedService = new BedService();

function requireAdminHospital(req: Request): string {
  if (!req.user?.hospitalId) {
    throw new ForbiddenError('Your account is not scoped to a hospital');
  }
  return req.user.hospitalId;
}

export const BedController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const hospitalId = requireAdminHospital(req);
    const category = typeof req.query.category === 'string' ? (req.query.category as BedCategory) : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as BedStatus) : undefined;
    const beds = await bedService.listForHospital(hospitalId, { category, status });
    res.status(200).json({ data: beds });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.getById(req.params.id, req.user!);
    res.status(200).json({ data: bed });
  }),

  allocate: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.allocate(req.params.id, req.body.patientId, req.user!);
    res.status(200).json({ data: bed });
  }),

  reserve: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.reserve(req.params.id, req.user!);
    res.status(200).json({ data: bed });
  }),

  cancelReservation: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.cancelReservation(req.params.id, req.user!);
    res.status(200).json({ data: bed });
  }),

  discharge: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.discharge(req.params.id, req.user!);
    res.status(200).json({ data: bed });
  }),

  markCleaned: asyncHandler(async (req: Request, res: Response) => {
    const bed = await bedService.markCleaned(req.params.id, req.user!);
    res.status(200).json({ data: bed });
  }),
};