import { z } from 'zod';
import { emptySchema, idParamSchema, paginationQuery } from '../../common/validation';

export const createAppointmentSchema = z.object({
  body: z.object({
    doctorId: z.string().uuid('doctorId must be a valid UUID'),
    slotStart: z
      .string()
      .datetime({ message: 'slotStart must be an ISO 8601 timestamp' })
      .refine((val) => new Date(val).getTime() > Date.now(), {
        message: 'slotStart must be in the future',
      }),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const rescheduleAppointmentSchema = z.object({
  body: z.object({
    newSlotStart: z
      .string()
      .datetime({ message: 'newSlotStart must be an ISO 8601 timestamp' })
      .refine((val) => new Date(val).getTime() > Date.now(), {
        message: 'newSlotStart must be in the future',
      }),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: emptySchema,
});

export const listAppointmentsQuerySchema = z.object({
  query: z.object(paginationQuery),
  body: emptySchema,
  params: emptySchema,
});

export const appointmentIdParamSchema = idParamSchema('id', 'Invalid appointment id');

export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>['body'];
export type RescheduleAppointmentBody = z.infer<typeof rescheduleAppointmentSchema>['body'];