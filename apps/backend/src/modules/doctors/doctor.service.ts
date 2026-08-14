import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { NotFoundError } from '../../common/errors';
import { DoctorSummary, PaginationMeta } from './doctor.types';

const doctorWithRelationsArgs = Prisma.validator<Prisma.DoctorDefaultArgs>()({
  include: { user: true, hospital: true },
});
type DoctorWithRelations = Prisma.DoctorGetPayload<typeof doctorWithRelationsArgs>;

export class DoctorService {
  async list(search: string | undefined, specialty: string | undefined, page: number, limit: number) {
    const where: Prisma.DoctorWhereInput = {
      licenseVerified: true,
      ...(specialty ? { specialty: { equals: specialty, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { specialty: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: { user: true, hospital: true },
        orderBy: { user: { name: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doctor.count({ where }),
    ]);

    const meta: PaginationMeta = { page, limit, total };
    return { data: items.map(toDoctorSummary), meta };
  }

  async getById(id: string): Promise<DoctorSummary> {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { user: true, hospital: true },
    });
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }
    return toDoctorSummary(doctor);
  }
}

function toDoctorSummary(doctor: DoctorWithRelations): DoctorSummary {
  return {
    id: doctor.id,
    name: doctor.user.name,
    specialty: doctor.specialty,
    hospitalId: doctor.hospitalId,
    hospitalName: doctor.hospital.name,
    avgConsultMinutes: doctor.avgConsultMinutes,
    licenseVerified: doctor.licenseVerified,
  };
}
