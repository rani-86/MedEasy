import { z } from 'zod';
import { emptySchema, idParamSchema, paginationQuery } from '../../common/validation';

export const listDoctorsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().min(1).optional(),
    specialty: z.string().trim().min(1).optional(),
    ...paginationQuery,
  }),
  body: emptySchema,
  params: emptySchema,
});

export const doctorIdParamSchema = idParamSchema('id', 'Invalid doctor id');

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>['query'];
