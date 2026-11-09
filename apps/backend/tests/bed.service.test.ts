import { randomUUID } from 'crypto';
import { prisma } from '../src/config/db';
import { redisClient } from '../src/config/redis';
import { BedService } from '../src/modules/beds/bed.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../src/common/errors';
import { AccessTokenPayload } from '../src/modules/auth/auth.types';

// Exercises the bed state machine's guard rails directly against Postgres: a status
// transition is only legal from specific prior states (vacant -> reserved -> occupied ->
// cleaning -> vacant), and an admin from a different hospital must never be able to touch
// another hospital's bed. Mocking Prisma would only prove the mock agrees with the code.
describe('BedService — status transition guards', () => {
  const service = new BedService();
  const runId = randomUUID().slice(0, 8);

  let hospitalId: string;
  let otherHospitalId: string;
  let adminUser: AccessTokenPayload;
  let otherHospitalAdmin: AccessTokenPayload;
  let patientId: string;

  beforeAll(async () => {
    const hospital = await prisma.hospital.create({
      data: {
        name: `Bed Test Hospital ${runId}`,
        address: 'Test Fixture — safe to delete',
        registrationId: `TEST-BED-${runId}`,
        verified: true,
      },
    });
    hospitalId = hospital.id;

    const otherHospital = await prisma.hospital.create({
      data: {
        name: `Bed Test Other Hospital ${runId}`,
        address: 'Test Fixture — safe to delete',
        registrationId: `TEST-BED-OTHER-${runId}`,
        verified: true,
      },
    });
    otherHospitalId = otherHospital.id;

    const patient = await prisma.user.create({
      data: {
        role: 'patient',
        name: `Bed Test Patient ${runId}`,
        phone: `+9188888${runId.slice(0, 2)}00`,
        verifiedAt: new Date(),
        patientProfile: { create: {} },
      },
      include: { patientProfile: true },
    });
    patientId = patient.patientProfile!.id;

    adminUser = { sub: randomUUID(), role: 'admin', hospitalId };
    otherHospitalAdmin = { sub: randomUUID(), role: 'admin', hospitalId: otherHospitalId };
  });

  afterAll(async () => {
    await prisma.bedAdmission.deleteMany({ where: { bed: { hospitalId: { in: [hospitalId, otherHospitalId] } } } });
    await prisma.bed.deleteMany({ where: { hospitalId: { in: [hospitalId, otherHospitalId] } } });
    await prisma.user.deleteMany({ where: { name: { contains: runId } } });
    await prisma.hospital.deleteMany({ where: { id: { in: [hospitalId, otherHospitalId] } } });
    redisClient.disconnect();
    await prisma.$disconnect();
  });

  async function makeBed(status: 'vacant' | 'reserved' | 'occupied' | 'cleaning' = 'vacant') {
    return prisma.bed.create({
      data: {
        hospitalId,
        bedNumber: `B-${randomUUID().slice(0, 8)}`,
        category: 'general',
        status,
      },
    });
  }

  it('walks a bed through vacant -> reserved -> occupied -> cleaning -> vacant', async () => {
    const bed = await makeBed('vacant');

    const reserved = await service.reserve(bed.id, adminUser);
    expect(reserved.status).toBe('reserved');

    const occupied = await service.allocate(bed.id, patientId, adminUser);
    expect(occupied.status).toBe('occupied');
    expect(occupied.currentPatientId).toBe(patientId);

    const cleaning = await service.discharge(bed.id, adminUser);
    expect(cleaning.status).toBe('cleaning');
    expect(cleaning.currentPatientId).toBeNull();

    const vacant = await service.markCleaned(bed.id, adminUser);
    expect(vacant.status).toBe('vacant');
  });

  it('rejects allocating a bed that is already occupied', async () => {
    const bed = await makeBed('occupied');
    await expect(service.allocate(bed.id, patientId, adminUser)).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects reserving a bed that is not vacant', async () => {
    const bed = await makeBed('cleaning');
    await expect(service.reserve(bed.id, adminUser)).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects discharging a bed that is not occupied', async () => {
    const bed = await makeBed('vacant');
    await expect(service.discharge(bed.id, adminUser)).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects an admin acting on a bed belonging to a different hospital', async () => {
    const bed = await makeBed('vacant');
    await expect(service.reserve(bed.id, otherHospitalAdmin)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws NotFoundError for a bed id that does not exist', async () => {
    await expect(service.getById(randomUUID(), adminUser)).rejects.toBeInstanceOf(NotFoundError);
  });
});
