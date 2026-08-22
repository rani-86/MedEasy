import { randomUUID } from 'crypto';
import { prisma } from '../src/config/db';
import { redisClient } from '../src/config/redis';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { ConflictError } from '../src/common/errors';

// The claim under test: two patients cannot both end up with a `booked` appointment for the
// same doctor at the same slot, no matter how many requests arrive at once. This is the thing
// a Redis lock + a Postgres compound unique constraint are *for* — so the test has to actually
// race real concurrent requests against real Postgres and real Redis, not mocks of either.
// Mocking the lock would prove the mock works, not that double-booking is prevented.
describe('AppointmentService — concurrent booking of the same slot', () => {
  const service = new AppointmentService();
  const runId = randomUUID().slice(0, 8);

  let hospitalId: string;
  let doctorId: string;
  let patientProfileIds: string[];
  const slotStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // one week out

  beforeAll(async () => {
    const hospital = await prisma.hospital.create({
      data: {
        name: `Concurrency Test Hospital ${runId}`,
        address: 'Test Fixture — safe to delete',
        registrationId: `TEST-CONCURRENCY-${runId}`,
        verified: true,
      },
    });
    hospitalId = hospital.id;

    const doctorUser = await prisma.user.create({
      data: {
        role: 'doctor',
        name: `Dr. Test Concurrency ${runId}`,
        email: `test-concurrency-doctor-${runId}@example.com`,
        verifiedAt: new Date(),
        doctor: {
          create: {
            hospitalId,
            specialty: 'General Medicine',
            licenseNo: `TEST-LICENSE-${runId}`,
            licenseVerified: true,
            avgConsultMinutes: 15,
          },
        },
      },
      include: { doctor: true },
    });
    doctorId = doctorUser.doctor!.id;

    const patientCount = 10;
    const patients = await Promise.all(
      Array.from({ length: patientCount }, (_, i) =>
        prisma.user.create({
          data: {
            role: 'patient',
            name: `Test Patient ${runId}-${i}`,
            phone: `+9199999${runId.slice(0, 2)}${String(i).padStart(2, '0')}`,
            verifiedAt: new Date(),
            patientProfile: { create: {} },
          },
          include: { patientProfile: true },
        }),
      ),
    );
    patientProfileIds = patients.map((p) => p.patientProfile!.id);
  });

  afterAll(async () => {
    // Doctor and PatientProfile both cascade-delete when their User is removed (see
    // schema.prisma), so deleting the appointments and the users is enough — the only thing
    // that would otherwise dangle is the hospital itself.
    await prisma.appointment.deleteMany({ where: { doctorId } });
    await prisma.user.deleteMany({ where: { name: { contains: runId } } });
    await prisma.hospital.deleteMany({ where: { id: hospitalId } });
    redisClient.disconnect();
    await prisma.$disconnect();
  });

  it('lets exactly one of many simultaneous bookings for the same slot succeed', async () => {
    const results = await Promise.allSettled(
      patientProfileIds.map((patientId) => service.bookAppointment(patientId, doctorId, slotStart)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(patientProfileIds.length - 1);
    // Every loser rejects with the expected, understood error — not some unrelated crash.
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ConflictError);
    }

    // The real assertion: the database — the actual source of truth, not the lock — agrees
    // there is exactly one booked row for this doctor and slot.
    const bookedCount = await prisma.appointment.count({
      where: { doctorId, slotStart: new Date(slotStart), status: 'booked' },
    });
    expect(bookedCount).toBe(1);
  });
});
