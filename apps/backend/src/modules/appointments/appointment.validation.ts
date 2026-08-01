import { z } from 'zod';

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
  query: z.object({}).optional(),
  params: z.object({}).optional(),
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
  query: z.object({}).optional(),
});

export const listAppointmentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const appointmentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid appointment id'),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>['body'];
export type RescheduleAppointmentBody = z.infer<typeof rescheduleAppointmentSchema>['body'];