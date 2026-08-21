import { prisma } from '../../config/db';
import { NotFoundError } from '../../common/errors';
import { UpdateMeInput } from './patient.validation';

export class PatientService {
  async getMe(patientProfileId: string) {
    const profile = await prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: { user: true },
    });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }
    return this.toPatientSummary(profile);
  }

  // Email lives on User, age/illnessType live on PatientProfile — a duplicate email
  // (already used by another account) surfaces as a Prisma P2002, which the global
  // error handler already converts into a 409, so no special-casing needed here.
  async updateMe(patientProfileId: string, userId: string, input: UpdateMeInput) {
    const [profile] = await prisma.$transaction([
      prisma.patientProfile.update({
        where: { id: patientProfileId },
        data: { age: input.age, illnessType: input.illnessType },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { email: input.email },
      }),
    ]);

    return this.getMe(profile.id);
  }

  private toPatientSummary(profile: {
    id: string;
    age: number | null;
    illnessType: string | null;
    user: { name: string; phone: string | null; email: string | null };
  }) {
    return {
      id: profile.id,
      name: profile.user.name,
      phone: profile.user.phone,
      email: profile.user.email,
      age: profile.age,
      illnessType: profile.illnessType,
      profileComplete: profile.age !== null && profile.illnessType !== null,
    };
  }
}
