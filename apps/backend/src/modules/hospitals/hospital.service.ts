import { prisma } from '../../config/db';
import { hashPassword } from '../auth/auth.service';
import { RegisterHospitalInput } from './hospital.validation';

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
}
