import { z } from 'zod';
import { emptySchema, latitudeSchema, longitudeSchema } from '../../common/validation';

export const registerHospitalSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    registrationId: z.string().trim().min(3).max(50),
    // Required going forward — a hospital with no coordinates can't appear in nearest-hospital
    // search. Existing pre-migration rows are nullable at the DB level for that reason, but
    // every new registration provides them.
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    adminName: z.string().trim().min(2).max(150),
    adminEmail: z.string().email('Must be a valid email address'),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: emptySchema,
  params: emptySchema,
});

export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>['body'];

export const nearbyHospitalsQuerySchema = z.object({
  query: z.object({
    lat: latitudeSchema,
    lng: longitudeSchema,
    illnessType: z.string().trim().min(1).optional(),
  }),
  body: emptySchema,
  params: emptySchema,
});

export type NearbyHospitalsQuery = z.infer<typeof nearbyHospitalsQuerySchema>['query'];
