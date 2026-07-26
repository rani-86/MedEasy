import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const doctorPasswordHash = await bcrypt.hash('DoctorPass123!', 12);
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 12);

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
          hospitalId: '11111111-1111-1111-1111-111111111111',
          specialty: 'Cardiology',
          licenseNo: 'MCI-BR-20191234',
          licenseVerified: true,
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
