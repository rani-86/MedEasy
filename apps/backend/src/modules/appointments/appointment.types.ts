export interface BookAppointmentInput {
  doctorId: string;
  slotStart: string;
}

export interface RescheduleAppointmentInput {
  newSlotStart: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}