import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './auth.socket';
import { AccessTokenPayload } from '../modules/auth/auth.types';
import { logger } from '../config/logger';

export interface BedStatusChangedPayload {
  bedId: string;
  bedNumber: string;
  category: string;
  status: string;
}

export function registerBedsNamespace(io: Server): void {
  const nsp = io.of('/beds');
  nsp.use(socketAuthMiddleware);

  nsp.on('connection', (socket: Socket) => {
    const user = socket.data.user as AccessTokenPayload;

    if (user.role !== 'admin' || !user.hospitalId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`hospital:${user.hospitalId}`);
    logger.info({ userId: user.sub, hospitalId: user.hospitalId }, 'Admin connected to /beds namespace');

    socket.on('disconnect', () => {});
  });
}

export function emitBedStatusChanged(io: Server, hospitalId: string, payload: BedStatusChangedPayload): void {
  io.of('/beds').to(`hospital:${hospitalId}`).emit('bed:status_changed', payload);
}

export interface EmergencyAlertPayload {
  emergencyId: string;
  patientName: string;
  patientPhone: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

// Reuses the /beds namespace rather than a new one — admins are already connected here via
// the bed dashboard, and an incoming emergency is part of the same "hospital operations"
// audience as bed status, not a separate concern that needs its own connection.
export function emitEmergencyAlert(io: Server, hospitalId: string, payload: EmergencyAlertPayload): void {
  io.of('/beds').to(`hospital:${hospitalId}`).emit('emergency:new', payload);
}