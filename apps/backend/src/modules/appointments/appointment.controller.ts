import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppointmentService } from './appointment.service';
import { ForbiddenError, ValidationError } from '../../common/errors';

const appointmentService = new AppointmentService();

export const AppointmentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.patientProfileId) {
      throw new ForbiddenError('Only patients can book appointments');
    }
    const appointment = await appointmentService.bookAppointment(
      req.user.patientProfileId,
      req.body.doctorId,
      req.body.slotStart,
    );
    res.status(201).json({ data: appointment });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentService.getById(req.params.id, req.user!);
    res.status(200).json({ data: appointment });
  }),

  listForPatient: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.patientProfileId) {
      throw new ForbiddenError('Only patients can list their own appointments');
    }
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await appointmentService.listForPatient(req.user.patientProfileId, page, limit);
    res.status(200).json(result);
  }),

  listForDoctor: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.doctorId) {
      throw new ForbiddenError('Only doctors can list their own queue');
    }
    const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (!dateParam) {
      throw new ValidationError([{ field: 'date', message: 'A date query param (YYYY-MM-DD) is required' }]);
    }
    const dateFrom = new Date(`${dateParam}T00:00:00.000Z`);
    const dateTo = new Date(`${dateParam}T23:59:59.999Z`);
    const appointments = await appointmentService.listForDoctor(req.user.doctorId, dateFrom, dateTo);
    res.status(200).json({ data: appointments });
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    await appointmentService.cancel(req.params.id, req.user!);
    res.status(204).send();
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.doctorId) {
      throw new ForbiddenError('Only the attending doctor can complete a consultation');
    }
    const appointment = await appointmentService.complete(req.params.id, req.user);
    res.status(200).json({ data: appointment });
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const updated = await appointmentService.reschedule(req.params.id, req.body.newSlotStart, req.user!);
    res.status(200).json({ data: updated });
  }),
};