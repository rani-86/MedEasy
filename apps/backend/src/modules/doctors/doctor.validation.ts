import { z } from 'zod';

export const listDoctorsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().min(1).optional(),
    specialty: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const doctorIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid doctor id'),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>['query'];
