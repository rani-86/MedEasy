import { apiClient } from './client';

export type BedCategory = 'icu' | 'general' | 'maternity' | 'isolation' | 'emergency';
export type BedStatus = 'vacant' | 'occupied' | 'reserved' | 'cleaning';

export interface Bed {
  id: string;
  hospitalId: string;
  category: BedCategory;
  bedNumber: string;
  status: BedStatus;
  currentPatientId: string | null;
  updatedAt: string;
}

export const bedApi = {
  list: async (): Promise<Bed[]> => {
    const res = await apiClient.get('/beds');
    return res.data.data;
  },
  allocate: async (id: string, patientId: string): Promise<Bed> => {
    const res = await apiClient.patch(`/beds/${id}/allocate`, { patientId });
    return res.data.data;
  },
  reserve: async (id: string): Promise<Bed> => {
    const res = await apiClient.patch(`/beds/${id}/reserve`);
    return res.data.data;
  },
  cancelReservation: async (id: string): Promise<Bed> => {
    const res = await apiClient.patch(`/beds/${id}/cancel-reservation`);
    return res.data.data;
  },
  discharge: async (id: string): Promise<Bed> => {
    const res = await apiClient.patch(`/beds/${id}/discharge`);
    return res.data.data;
  },
  markCleaned: async (id: string): Promise<Bed> => {
    const res = await apiClient.patch(`/beds/${id}/mark-cleaned`);
    return res.data.data;
  },
};
