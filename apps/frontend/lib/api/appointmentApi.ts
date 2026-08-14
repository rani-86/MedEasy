import { apiClient } from './client';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  slotStart: string;
  slotEnd: string;
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  createdAt: string;
}

export interface QueueAppointment extends Appointment {
  patientName: string;
}

export const appointmentApi = {
  book: async (doctorId: string, slotStart: string): Promise<Appointment> => {
    const res = await apiClient.post('/appointments', { doctorId, slotStart });
    return res.data.data;
  },

  list: async (): Promise<Appointment[]> => {
    const res = await apiClient.get('/appointments');
    return res.data.data;
  },

  getById: async (id: string): Promise<Appointment> => {
    const res = await apiClient.get(`/appointments/${id}`);
    return res.data.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.patch(`/appointments/${id}/cancel`);
  },

  listForDoctorQueue: async (date: string): Promise<QueueAppointment[]> => {
    const res = await apiClient.get('/appointments/queue/today', { params: { date } });
    return res.data.data;
  },
  reschedule: async (id: string, newSlotStart: string): Promise<Appointment> => {
    const res = await apiClient.patch(`/appointments/${id}/reschedule`, { newSlotStart });
    return res.data.data;
  },
};