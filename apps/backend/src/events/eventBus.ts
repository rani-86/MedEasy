import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

export type DomainEvent =
  | { type: 'AppointmentBooked'; payload: { appointmentId: string; doctorId: string; hospitalId: string; patientId: string; slotStart: string } }
  | { type: 'AppointmentCancelled'; payload: { appointmentId: string; doctorId: string } }
  | { type: 'AppointmentCompleted'; payload: { appointmentId: string; doctorId: string } };

const CHANNEL = 'medeasy:events';

export async function publishEvent(type: DomainEvent['type'], payload: DomainEvent['payload']): Promise<void> {
  try {
    await redisClient.publish(CHANNEL, JSON.stringify({ type, payload, publishedAt: new Date().toISOString() }));
  } catch (err) {
    logger.error({ err, type }, 'Failed to publish domain event');
  }
}