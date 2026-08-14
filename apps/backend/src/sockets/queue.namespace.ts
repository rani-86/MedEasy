import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './auth.socket';
import { AccessTokenPayload } from '../modules/auth/auth.types';
import { logger } from '../config/logger';
import { AppointmentStatus } from '@prisma/client';

export interface QueueUpdatedPayload {
  appointmentId: string;
  patientId: string;
  patientName: string;
  slotStart: string;
  status: AppointmentStatus;
  queueCount: number;
}

export function registerQueueNamespace(io: Server): void {
  const nsp = io.of('/queue');
  nsp.use(socketAuthMiddleware);

  nsp.on('connection', (socket: Socket) => {
    const user = socket.data.user as AccessTokenPayload;

    if (user.role !== 'doctor' || !user.doctorId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`doctor:${user.doctorId}`);
    logger.info({ userId: user.sub, doctorId: user.doctorId }, 'Doctor connected to /queue namespace');

    socket.on('disconnect', () => {});
  });
}

export function emitQueueUpdated(io: Server, doctorId: string, payload: QueueUpdatedPayload): void {
  io.of('/queue').to(`doctor:${doctorId}`).emit('queue:updated', payload);
}
