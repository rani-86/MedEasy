import { z } from 'zod';
import { ILLNESS_TYPES } from './patient.constants';

const indianPhoneRegex = /^\+91[6-9]\d{9}$/;

export const updateMySchema = z.object({
  body: z.object({
    age: z.coerce.number().int().min(0).max(130),
    illnessType: z.enum(ILLNESS_TYPES),
    email: z.string().email('Must be a valid email address'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const lookupByPhoneSchema = z.object({
  query: z.object({
    phone: z.string().regex(indianPhoneRegex, 'Must be a valid Indian phone number in +91XXXXXXXXXX format'),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMySchema>['body'];
