import { prisma } from '../../config/db';
import { BedCategory, BedStatus } from '@prisma/client';
import { NotFoundError, ConflictError, ForbiddenError } from '../../common/errors';
import { getSocketServer } from '../../sockets/socketRegistry';
import { emitBedStatusChanged } from '../../sockets/beds.namespace';
import { AccessTokenPayload } from '../auth/auth.types';

/**
 * Bed status state machine:
 *
 *   vacant ──allocate──> occupied ──discharge──> cleaning ──markCleaned──> vacant
 *     │                                                                      ^
 *     └──reserve──> reserved ──allocate──────────────────────────────────────┘
 *                      │
 *                      └──cancelReservation──> vacant
 *
 * "cleaning" is a deliberate intermediate state between occupied and vacant —
 * it exists specifically so a bed can never be re-allocated before housekeeping
 * has actually turned it over.
 */
export class BedService {
  async listForHospital(hospitalId: string, filters: { category?: BedCategory; status?: BedStatus }) {
    return prisma.bed.findMany({
      where: {
        hospitalId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ category: 'asc' }, { bedNumber: 'asc' }],
    });
  }

  async getById(id: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);
    return bed;
  }

  async allocate(bedId: string, patientId: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);

    if (bed.status !== 'vacant' && bed.status !== 'reserved') {
      throw new ConflictError(`Cannot allocate a bed with status "${bed.status}"`);
    }

    const [updatedBed] = await prisma.$transaction([
      prisma.bed.update({
        where: { id: bedId },
        data: { status: 'occupied', currentPatientId: patientId },
      }),
      prisma.bedAdmission.create({
        data: { bedId, patientId },
      }),
    ]);

    this.emit(updatedBed);
    return updatedBed;
  }

  async reserve(bedId: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);

    if (bed.status !== 'vacant') {
      throw new ConflictError(`Cannot reserve a bed with status "${bed.status}"`);
    }

    const updated = await prisma.bed.update({ where: { id: bedId }, data: { status: 'reserved' } });
    this.emit(updated);
    return updated;
  }

  async cancelReservation(bedId: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);

    if (bed.status !== 'reserved') {
      throw new ConflictError(`Cannot cancel a reservation on a bed with status "${bed.status}"`);
    }

    const updated = await prisma.bed.update({ where: { id: bedId }, data: { status: 'vacant' } });
    this.emit(updated);
    return updated;
  }

  async discharge(bedId: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);

    if (bed.status !== 'occupied') {
      throw new ConflictError(`Cannot discharge a bed with status "${bed.status}"`);
    }

    const updatedBed = await prisma.$transaction(async (tx) => {
      const openAdmission = await tx.bedAdmission.findFirst({
        where: { bedId, dischargedAt: null },
        orderBy: { admittedAt: 'desc' },
      });
      if (openAdmission) {
        await tx.bedAdmission.update({ where: { id: openAdmission.id }, data: { dischargedAt: new Date() } });
      }
      return tx.bed.update({
        where: { id: bedId },
        data: { status: 'cleaning', currentPatientId: null },
      });
    });

    this.emit(updatedBed);
    return updatedBed;
  }

  async markCleaned(bedId: string, adminUser: AccessTokenPayload) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new NotFoundError('Bed not found');
    }
    this.assertSameHospital(bed.hospitalId, adminUser);

    if (bed.status !== 'cleaning') {
      throw new ConflictError(`Cannot mark a bed with status "${bed.status}" as cleaned`);
    }

    const updated = await prisma.bed.update({ where: { id: bedId }, data: { status: 'vacant' } });
    this.emit(updated);
    return updated;
  }

  private assertSameHospital(bedHospitalId: string, adminUser: AccessTokenPayload) {
    if (adminUser.hospitalId !== bedHospitalId) {
      throw new ForbiddenError('You do not have access to beds at this hospital');
    }
  }

  private emit(bed: { id: string; hospitalId: string; bedNumber: string; category: string; status: string }) {
    const io = getSocketServer();
    if (!io) return;
    emitBedStatusChanged(io, bed.hospitalId, {
      bedId: bed.id,
      bedNumber: bed.bedNumber,
      category: bed.category,
      status: bed.status,
    });
  }
}