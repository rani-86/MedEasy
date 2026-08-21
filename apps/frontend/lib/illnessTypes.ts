// Keep this in sync with apps/backend/src/modules/patients/patient.constants.ts — the backend
// validates against the same list, and the values double as Doctor.specialty strings so
// picking one here directly powers specialist matching, no separate lookup needed.
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
