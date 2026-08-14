import { Appointment, AppointmentStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { acquireLock, releaseLock } from '../../common/utils/locks';
import { ConflictError, NotFoundError, ForbiddenError } from '../../common/errors';
import { publishEvent } from '../../events/eventBus';
import { getSocketServer } from '../../sockets/socketRegistry';
import { emitQueueUpdated } from '../../sockets/queue.namespace';
import { AccessTokenPayload } from '../auth/auth.types';
import { PaginationMeta } from './appointment.types';

const SLOT_LOCK_TTL_MS = 10_000;

export class AppointmentService {
  async bookAppointment(patientProfileId: string, doctorId: string, slotStartRaw: string) {
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }
    if (!doctor.licenseVerified) {
      throw new ConflictError('This doctor is not yet verified and cannot accept bookings');
    }

    const slotStart = new Date(slotStartRaw);
    const slotEnd = new Date(slotStart.getTime() + doctor.avgConsultMinutes * 60_000);

    const lockKey = `lock:slot:${doctorId}:${slotStart.toISOString()}`;
    const lockToken = await acquireLock(lockKey, SLOT_LOCK_TTL_MS);
    if (!lockToken) {
      throw new ConflictError('This slot is currently being booked by another patient. Please try again.');
    }

    try {
      const existing = await prisma.appointment.findFirst({
        where: { doctorId, slotStart, status: 'booked' },
      });
      if (existing) {
        throw new ConflictError('This slot has just been booked. Please choose another.');
      }

      const appointment = await prisma.appointment.create({
        data: {
          patientId: patientProfileId,
          doctorId,
          hospitalId: doctor.hospitalId,
          slotStart,
          slotEnd,
          status: 'booked',
        },
      });

      await publishEvent('AppointmentBooked', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        hospitalId: appointment.hospitalId,
        patientId: appointment.patientId,
        slotStart: appointment.slotStart.toISOString(),
      });
      await this.emitQueueUpdate(appointment);

      return appointment;
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  async getById(id: string, user: AccessTokenPayload) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    this.assertAccess(appointment, user);
    return appointment;
  }

  async listForPatient(patientProfileId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: patientProfileId },
        orderBy: { slotStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where: { patientId: patientProfileId } }),
    ]);

    const meta: PaginationMeta = { page, limit, total };
    return { data: items, meta };
  }

  async listForDoctor(doctorId: string, dateFrom: Date, dateTo: Date) {
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        slotStart: { gte: dateFrom, lt: dateTo },
        status: { in: ['booked', 'completed'] },
      },
      include: { patient: { include: { user: true } } },
      orderBy: { slotStart: 'asc' },
    });

    return appointments.map(({ patient, ...appointment }) => ({
      ...appointment,
      patientName: patient.user.name,
    }));
  }

  async cancel(id: string, user: AccessTokenPayload) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    this.assertAccess(appointment, user);
    if (appointment.status !== 'booked') {
      throw new ConflictError(`Cannot cancel an appointment with status "${appointment.status}"`);
    }

    const cancelled = await prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } });
    await publishEvent('AppointmentCancelled', { appointmentId: id, doctorId: appointment.doctorId });
    await this.emitQueueUpdate(cancelled);
  }

  async complete(id: string, doctorUser: AccessTokenPayload) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    if (appointment.doctorId !== doctorUser.doctorId) {
      throw new ForbiddenError('You do not have access to this appointment');
    }
    if (appointment.status !== 'booked') {
      throw new ConflictError(`Cannot complete an appointment with status "${appointment.status}"`);
    }

    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'completed' } });
    await publishEvent('AppointmentCompleted', { appointmentId: id, doctorId: appointment.doctorId });
    await this.emitQueueUpdate(updated);
    return updated;
  }

  async reschedule(id: string, newSlotStartRaw: string, user: AccessTokenPayload) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    this.assertAccess(appointment, user);
    if (appointment.status !== 'booked') {
      throw new ConflictError(`Cannot reschedule an appointment with status "${appointment.status}"`);
    }

    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: appointment.doctorId } });
    const newSlotStart = new Date(newSlotStartRaw);
    const newSlotEnd = new Date(newSlotStart.getTime() + doctor.avgConsultMinutes * 60_000);

    const lockKey = `lock:slot:${appointment.doctorId}:${newSlotStart.toISOString()}`;
    const lockToken = await acquireLock(lockKey, SLOT_LOCK_TTL_MS);
    if (!lockToken) {
      throw new ConflictError('This slot is currently being booked by another patient. Please try again.');
    }

    try {
      const conflict = await prisma.appointment.findFirst({
        where: { doctorId: appointment.doctorId, slotStart: newSlotStart, status: 'booked' },
      });
      if (conflict) {
        throw new ConflictError('The requested new slot is no longer available.');
      }

      const rebooked = await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id }, data: { status: 'cancelled' } });
        return tx.appointment.create({
          data: {
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            hospitalId: appointment.hospitalId,
            slotStart: newSlotStart,
            slotEnd: newSlotEnd,
            status: 'booked',
          },
        });
      });

      await publishEvent('AppointmentCancelled', { appointmentId: id, doctorId: appointment.doctorId });
      await publishEvent('AppointmentBooked', {
        appointmentId: rebooked.id,
        doctorId: rebooked.doctorId,
        hospitalId: rebooked.hospitalId,
        patientId: rebooked.patientId,
        slotStart: rebooked.slotStart.toISOString(),
      });

      return rebooked;
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  private assertAccess(appointment: { patientId: string }, user: AccessTokenPayload) {
    if (user.role === 'patient' && appointment.patientId !== user.patientProfileId) {
      throw new ForbiddenError('You do not have access to this appointment');
    }
  }

  private async emitQueueUpdate(appointment: Appointment) {
    const io = getSocketServer();
    if (!io) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const [patient, queueCount] = await Promise.all([
      prisma.patientProfile.findUnique({
        where: { id: appointment.patientId },
        include: { user: true },
      }),
      prisma.appointment.count({
        where: {
          doctorId: appointment.doctorId,
          status: 'booked' as AppointmentStatus,
          slotStart: { gte: new Date(`${todayStr}T00:00:00.000Z`), lt: new Date(`${todayStr}T23:59:59.999Z`) },
        },
      }),
    ]);

    emitQueueUpdated(io, appointment.doctorId, {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: patient?.user.name ?? 'Unknown patient',
      slotStart: appointment.slotStart.toISOString(),
      status: appointment.status,
      queueCount,
    });
  }
}