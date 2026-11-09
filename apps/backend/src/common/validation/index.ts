import { z } from 'zod';

// `validateRequest` always parses `{ body, query, params }` together (see
// middleware/validateRequest.ts), so every schema in every module needs to supply all three even
// when a route only cares about one of them. Centralizing the "I don't care about this part"
// placeholder, and the few validators repeated verbatim across modules (UUID route params,
// pagination, phone numbers, coordinates), means a module's own `*.validation.ts` file only has
// to spell out what's actually unique to it.

export const emptySchema = z.object({}).optional();

/** A `{ params: { [paramName]: uuid } }` schema for the common "one resource id in the URL" route shape. */
export function idParamSchema(paramName = 'id', message = 'Invalid id') {
  return z.object({
    params: z.object({ [paramName]: z.string().uuid(message) }),
    body: emptySchema,
    query: emptySchema,
  });
}

/** The `page`/`limit` query pair used by every paginated list endpoint. */
export const paginationQuery = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};

const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

/** An Indian mobile number in `+91XXXXXXXXXX` format — used by both auth (OTP) and patient lookup. */
export const indianPhoneSchema = z
  .string()
  .regex(INDIAN_PHONE_REGEX, 'Must be a valid Indian phone number in +91XXXXXXXXXX format');

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);
