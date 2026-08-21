import { prisma } from '../../config/db';
import { hashPassword } from '../auth/auth.service';
import { haversineDistanceKm } from '../../common/utils/geo';
import { RegisterHospitalInput, NearbyHospitalsQuery } from './hospital.validation';

export class HospitalService {
  // Creates the hospital and its first admin together — unverified until someone flips
  // Hospital.verified directly in the database, same manual pattern Doctor.licenseVerified
  // already uses. The new admin still needs to run MFA setup before they can log in.
  async register(input: RegisterHospitalInput) {
    const passwordHash = await hashPassword(input.adminPassword);

    // User.hospitalId is a plain scalar (no Prisma relation declared on either side), so
    // this is two creates in a transaction rather than one nested write.
    const hospital = await prisma.$transaction(async (tx) => {
      const created = await tx.hospital.create({
        data: {
          name: input.name,
          address: input.address,
          registrationId: input.registrationId,
          verified: false,
          latitude: input.latitude,
          longitude: input.longitude,
        },
      });
      await tx.user.create({
        data: {
          role: 'admin',
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          hospitalId: created.id,
          verifiedAt: new Date(),
        },
      });
      return created;
    });

    return {
      hospitalId: hospital.id,
      registrationId: hospital.registrationId,
      verified: hospital.verified,
    };
  }

  // Unverified hospitals and ones with no coordinates on file simply don't appear — there's
  // no partial/fallback ranking, since a distance we can't actually compute is worse than
  // just leaving the hospital out.
  async findNearby(query: NearbyHospitalsQuery) {
    const hospitals = await prisma.hospital.findMany({
      where: { verified: true, latitude: { not: null }, longitude: { not: null } },
    });
    if (hospitals.length === 0) return [];

    const hospitalIds = hospitals.map((h) => h.id);

    const [bedCounts, doctorCounts] = await Promise.all([
      prisma.bed.groupBy({
        by: ['hospitalId', 'status'],
        where: { hospitalId: { in: hospitalIds } },
        _count: true,
      }),
      prisma.doctor.groupBy({
        by: ['hospitalId'],
        where: {
          hospitalId: { in: hospitalIds },
          licenseVerified: true,
          ...(query.illnessType ? { specialty: query.illnessType } : {}),
        },
        _count: true,
      }),
    ]);

    return hospitals
      .map((hospital) => {
        const hospitalBedCounts = bedCounts.filter((b) => b.hospitalId === hospital.id);
        const totalBeds = hospitalBedCounts.reduce((sum, b) => sum + b._count, 0);
        const availableBeds = hospitalBedCounts.find((b) => b.status === 'vacant')?._count ?? 0;
        const matchingDoctors = doctorCounts.find((d) => d.hospitalId === hospital.id)?._count ?? 0;

        return {
          id: hospital.id,
          name: hospital.name,
          address: hospital.address,
          distanceKm: Math.round(haversineDistanceKm(query.lat, query.lng, hospital.latitude!, hospital.longitude!) * 10) / 10,
          totalBeds,
          availableBeds,
          matchingDoctors,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
