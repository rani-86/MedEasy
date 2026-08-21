// Deliberately the same vocabulary a Doctor's `specialty` field is written in — a patient's
// illness type IS a specialty selection, not a separate taxonomy that needs translating.
// Keep this list and the values doctors are seeded/onboarded with in sync.
export const ILLNESS_TYPES = [
  'Cardiology',
  'Dermatology',
  'ENT',
  'General Medicine',
  'Gynecology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Urology',
] as const;

export type IllnessType = (typeof ILLNESS_TYPES)[number];
