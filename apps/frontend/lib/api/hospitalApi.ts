import { apiClient } from './client';

export interface RegisterHospitalInput {
  name: string;
  address: string;
  registrationId: string;
  latitude: number;
  longitude: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface NearbyHospital {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  totalBeds: number;
  availableBeds: number;
  matchingDoctors: number;
}

export const hospitalApi = {
  register: async (input: RegisterHospitalInput): Promise<{ hospitalId: string; registrationId: string; verified: boolean }> => {
    const res = await apiClient.post('/hospitals/register', input);
    return res.data.data;
  },

  nearby: async (lat: number, lng: number, illnessType?: string): Promise<NearbyHospital[]> => {
    const res = await apiClient.get('/hospitals/nearby', { params: { lat, lng, illnessType } });
    return res.data.data;
  },
};
