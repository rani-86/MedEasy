import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const doctorPasswordHash = await bcrypt.hash('DoctorPass123!', 12);
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 12);

  const hospital = await prisma.hospital.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: { registrationId: 'APEX-HOSP-001', verified: true, latitude: 25.6146, longitude: 85.1189 },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Apex Multispecialty Hospital',
      address: 'Boring Road, Patna, Bihar',
      registrationId: 'APEX-HOSP-001',
      verified: true,
      latitude: 25.6146,
      longitude: 85.1189,
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
    update: { hospitalId: hospital.id },
    create: {
      role: 'admin',
      name: 'Suresh Prasad',
      email: 'suresh.p@apex.com',
      passwordHash: adminPasswordHash,
      hospitalId: hospital.id,
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

  await prisma.bed.upsert({
    where: { hospitalId_bedNumber: { hospitalId: hospital.id, bedNumber: 'ICU-01' } },
    update: {},
    create: { hospitalId: hospital.id, category: 'icu', bedNumber: 'ICU-01', status: 'vacant' },
  });
  await prisma.bed.upsert({
    where: { hospitalId_bedNumber: { hospitalId: hospital.id, bedNumber: 'GEN-14' } },
    update: {},
    create: { hospitalId: hospital.id, category: 'general', bedNumber: 'GEN-14', status: 'vacant' },
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