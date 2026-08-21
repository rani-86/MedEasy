import { z } from 'zod';

export const registerHospitalSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    registrationId: z.string().trim().min(3).max(50),
    // Required going forward — a hospital with no coordinates can't appear in nearest-hospital
    // search. Existing pre-migration rows are nullable at the DB level for that reason, but
    // every new registration provides them.
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    adminName: z.string().trim().min(2).max(150),
    adminEmail: z.string().email('Must be a valid email address'),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>['body'];

export const nearbyHospitalsQuerySchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    illnessType: z.string().trim().min(1).optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type NearbyHospitalsQuery = z.infer<typeof nearbyHospitalsQuerySchema>['query'];
