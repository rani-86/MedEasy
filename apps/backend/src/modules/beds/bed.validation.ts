import { z } from 'zod';
import { emptySchema, idParamSchema } from '../../common/validation';

export const bedIdParamSchema = idParamSchema('id', 'Invalid bed id');

export const allocateBedSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid bed id'),
  }),
  body: z.object({
    patientId: z.string().uuid('patientId must be a valid UUID'),
  }),
  query: emptySchema,
});

export const listBedsQuerySchema = z.object({
  query: z.object({
    category: z.enum(['icu', 'general', 'maternity', 'isolation', 'emergency']).optional(),
    status: z.enum(['vacant', 'occupied', 'reserved', 'cleaning']).optional(),
  }),
  body: emptySchema,
  params: emptySchema,
});

export type AllocateBedBody = z.infer<typeof allocateBedSchema>['body'];