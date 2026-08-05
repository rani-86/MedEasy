import { z } from 'zod';

export const bedIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid bed id'),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const allocateBedSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid bed id'),
  }),
  body: z.object({
    patientId: z.string().uuid('patientId must be a valid UUID'),
  }),
  query: z.object({}).optional(),
});

export const listBedsQuerySchema = z.object({
  query: z.object({
    category: z.enum(['icu', 'general', 'maternity', 'isolation', 'emergency']).optional(),
    status: z.enum(['vacant', 'occupied', 'reserved', 'cleaning']).optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type AllocateBedBody = z.infer<typeof allocateBedSchema>['body'];