import { z } from 'zod';

export const registerHospitalSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    registrationId: z.string().trim().min(3).max(50),
    adminName: z.string().trim().min(2).max(150),
    adminEmail: z.string().email('Must be a valid email address'),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>['body'];
