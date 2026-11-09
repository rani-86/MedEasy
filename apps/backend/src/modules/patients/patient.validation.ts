import { z } from 'zod';
import { ILLNESS_TYPES } from './patient.constants';
import { emptySchema, indianPhoneSchema } from '../../common/validation';

export const updateMySchema = z.object({
  body: z.object({
    age: z.coerce.number().int().min(0).max(130),
    illnessType: z.enum(ILLNESS_TYPES),
    email: z.string().email('Must be a valid email address'),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const lookupByPhoneSchema = z.object({
  query: z.object({
    phone: indianPhoneSchema,
  }),
  body: emptySchema,
  params: emptySchema,
});

export type UpdateMeInput = z.infer<typeof updateMySchema>['body'];
