import { z } from 'zod';

export const createEmergencySchema = z.object({
  body: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>['body'];

export const emergencyIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid emergency id'),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});
