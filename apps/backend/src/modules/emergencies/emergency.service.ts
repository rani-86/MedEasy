import { prisma } from '../../config/db';
import { getSocketServer } from '../../sockets/socketRegistry';
import { emitEmergencyAlert } from '../../sockets/beds.namespace';
import { haversineDistanceKm } from '../../common/utils/geo';
import { NotFoundError, ForbiddenError, ConflictError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/auth.types';
import { CreateEmergencyInput } from './emergency.validation';

export class EmergencyService {
  // Finds the nearest verified, coordinated hospital and records it on the request — not
  // recomputed later, since "which hospital was nearest" is part of the incident record,
  // not a live value that should drift if a closer hospital registers afterward.
  async create(patientProfileId: string, input: CreateEmergencyInput) {
    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: { user: true },
    });
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }

    const candidates = await prisma.hospital.findMany({
      where: { verified: true, latitude: { not: null }, longitude: { not: null } },
    });
    if (candidates.length === 0) {
      throw new ConflictError('No verified hospitals are available to notify right now');
    }

    const nearest = candidates
      .map((h) => ({ hospital: h, distanceKm: haversineDistanceKm(input.latitude, input.longitude, h.latitude!, h.longitude!) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    const request = await prisma.emergencyRequest.create({
      data: {
        patientId: patientProfileId,
        hospitalId: nearest.hospital.id,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });

    const io = getSocketServer();
    if (io) {
      emitEmergencyAlert(io, nearest.hospital.id, {
        emergencyId: request.id,
        patientName: patient.user.name,
        patientPhone: patient.user.phone,
        latitude: input.latitude,
        longitude: input.longitude,
        distanceKm: Math.round(nearest.distanceKm * 10) / 10,
      });
    }

    return {
      id: request.id,
      hospitalId: nearest.hospital.id,
      hospitalName: nearest.hospital.name,
      distanceKm: Math.round(nearest.distanceKm * 10) / 10,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  async listForHospital(hospitalId: string) {
    const requests = await prisma.emergencyRequest.findMany({
      where: { hospitalId },
      include: { patient: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return requests.map((r) => ({
      id: r.id,
      patientName: r.patient.user.name,
      patientPhone: r.patient.user.phone,
      latitude: r.latitude,
      longitude: r.longitude,
      status: r.status,
      createdAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt,
    }));
  }

  async acknowledge(id: string, adminUser: AccessTokenPayload) {
    const request = await prisma.emergencyRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundError('Emergency request not found');
    }
    if (request.hospitalId !== adminUser.hospitalId) {
      throw new ForbiddenError('You do not have access to this emergency request');
    }
    if (request.status !== 'pending') {
      throw new ConflictError(`Cannot acknowledge a request with status "${request.status}"`);
    }

    return prisma.emergencyRequest.update({
      where: { id },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
  }
}
