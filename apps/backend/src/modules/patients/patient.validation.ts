import { z } from 'zod';
import { ILLNESS_TYPES } from './patient.constants';

export const updateMySchema = z.object({
  body: z.object({
    age: z.coerce.number().int().min(0).max(130),
    illnessType: z.enum(ILLNESS_TYPES),
    email: z.string().email('Must be a valid email address'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMySchema>['body'];
