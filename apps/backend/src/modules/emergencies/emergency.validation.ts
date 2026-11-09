import { z } from 'zod';
import { emptySchema, idParamSchema, latitudeSchema, longitudeSchema } from '../../common/validation';

export const createEmergencySchema = z.object({
  body: z.object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  }),
  query: emptySchema,
  params: emptySchema,
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>['body'];

export const emergencyIdParamSchema = idParamSchema('id', 'Invalid emergency id');
