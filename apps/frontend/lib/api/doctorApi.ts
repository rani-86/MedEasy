import { apiClient } from './client';

export interface Doctor {
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

export const doctorApi = {
  list: async (search?: string): Promise<{ data: Doctor[]; meta: PaginationMeta }> => {
    const res = await apiClient.get('/doctors', { params: search ? { search } : {} });
    return res.data;
  },
};
