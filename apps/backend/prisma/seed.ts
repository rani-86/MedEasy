import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const doctorPasswordHash = await bcrypt.hash('DoctorPass123!', 12);
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 12);

  const hospital = await prisma.hospital.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Apex Multispecialty Hospital',
      address: 'Boring Road, Patna, Bihar',
    },
  });

  await prisma.user.upsert({
    where: { email: 'anjali.sharma@apex.com' },
    update: {},
    create: {
      role: 'doctor',
      name: 'Dr. Anjali Sharma',
      email: 'anjali.sharma@apex.com',
      passwordHash: doctorPasswordHash,
      verifiedAt: new Date(),
      doctor: {
        create: {
          hospitalId: hospital.id,
          specialty: 'Cardiology',
          licenseNo: 'MCI-BR-20191234',
          licenseVerified: true,
          avgConsultMinutes: 20,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: 'suresh.p@apex.com' },
    update: {},
    create: {
      role: 'admin',
      name: 'Suresh Prasad',
      email: 'suresh.p@apex.com',
      passwordHash: adminPasswordHash,
      verifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { phone: '+919000000001' },
    update: {},
    create: {
      role: 'patient',
      name: 'Rohit Kumar',
      phone: '+919000000001',
      verifiedAt: new Date(),
      patientProfile: { create: {} },
    },
  });

  console.log('Seed complete. Note: admin TOTP secret must be provisioned separately via the MFA setup flow.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });