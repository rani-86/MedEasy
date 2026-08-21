import { apiClient } from './client';

export interface PatientProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  illnessType: string | null;
  profileComplete: boolean;
}

export interface UpdatePatientProfileInput {
  age: number;
  illnessType: string;
  email: string;
}

export const patientApi = {
  getMe: async (): Promise<PatientProfile> => {
    const res = await apiClient.get('/patients/me');
    return res.data.data;
  },

  updateMe: async (input: UpdatePatientProfileInput): Promise<PatientProfile> => {
    const res = await apiClient.patch('/patients/me', input);
    return res.data.data;
  },

  lookupByPhone: async (phone: string): Promise<PatientProfile> => {
    const res = await apiClient.get('/patients/lookup', { params: { phone } });
    return res.data.data;
  },
};
