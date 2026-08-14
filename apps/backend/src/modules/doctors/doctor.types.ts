export interface DoctorSummary {
  id: string;
  name: string;
  specialty: string;
  hospitalId: string;
  hospitalName: string;
  avgConsultMinutes: number;
  licenseVerified: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}
