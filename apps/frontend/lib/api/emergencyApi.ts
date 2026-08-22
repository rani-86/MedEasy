import { apiClient } from './client';

export interface EmergencyCreated {
  id: string;
  hospitalId: string;
  hospitalName: string;
  distanceKm: number;
  status: 'pending' | 'acknowledged' | 'resolved';
  createdAt: string;
}

export interface EmergencyRequestItem {
  id: string;
  patientName: string;
  patientPhone: string | null;
  latitude: number;
  longitude: number;
  status: 'pending' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt: string | null;
}

export const emergencyApi = {
  create: async (latitude: number, longitude: number): Promise<EmergencyCreated> => {
    const res = await apiClient.post('/emergencies', { latitude, longitude });
    return res.data.data;
  },
  list: async (): Promise<EmergencyRequestItem[]> => {
    const res = await apiClient.get('/emergencies');
    return res.data.data;
  },
  acknowledge: async (id: string): Promise<void> => {
    await apiClient.patch(`/emergencies/${id}/acknowledge`);
  },
};
