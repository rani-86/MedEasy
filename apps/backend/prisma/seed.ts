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

  // One doctor per specialty besides Cardiology, so specialty-matched search and nearest-hospital
  // results have something real to show in every category — all fictional, at the one hospital
  // this demo actually seeds, not real named individuals pulled from anywhere.
  const otherDoctors: { name: string; email: string; specialty: string; licenseNo: string; avgConsultMinutes: number }[] = [
    { name: 'Dr. Neha Verma', email: 'neha.verma@apex.com', specialty: 'Dermatology', licenseNo: 'MCI-BR-20192001', avgConsultMinutes: 15 },
    { name: 'Dr. Rajesh Kumar', email: 'rajesh.kumar@apex.com', specialty: 'ENT', licenseNo: 'MCI-BR-20192002', avgConsultMinutes: 15 },
    { name: 'Dr. Alok Mishra', email: 'alok.mishra@apex.com', specialty: 'General Medicine', licenseNo: 'MCI-BR-20192003', avgConsultMinutes: 15 },
    { name: 'Dr. Kavita Reddy', email: 'kavita.reddy@apex.com', specialty: 'Gynecology', licenseNo: 'MCI-BR-20192004', avgConsultMinutes: 20 },
    { name: 'Dr. Arjun Mehta', email: 'arjun.mehta@apex.com', specialty: 'Neurology', licenseNo: 'MCI-BR-20192005', avgConsultMinutes: 25 },
    { name: 'Dr. Sunita Rao', email: 'sunita.rao@apex.com', specialty: 'Oncology', licenseNo: 'MCI-BR-20192006', avgConsultMinutes: 30 },
    { name: 'Dr. Vikram Chauhan', email: 'vikram.chauhan@apex.com', specialty: 'Ophthalmology', licenseNo: 'MCI-BR-20192007', avgConsultMinutes: 15 },
    { name: 'Dr. Manoj Gupta', email: 'manoj.gupta@apex.com', specialty: 'Orthopedics', licenseNo: 'MCI-BR-20192008', avgConsultMinutes: 20 },
    { name: 'Dr. Priya Nair', email: 'priya.nair@apex.com', specialty: 'Pediatrics', licenseNo: 'MCI-BR-20192009', avgConsultMinutes: 15 },
    { name: 'Dr. Rohan Bhatt', email: 'rohan.bhatt@apex.com', specialty: 'Psychiatry', licenseNo: 'MCI-BR-20192010', avgConsultMinutes: 30 },
    { name: 'Dr. Deepak Joshi', email: 'deepak.joshi@apex.com', specialty: 'Pulmonology', licenseNo: 'MCI-BR-20192011', avgConsultMinutes: 20 },
    { name: 'Dr. Sanjay Chatterjee', email: 'sanjay.chatterjee@apex.com', specialty: 'Urology', licenseNo: 'MCI-BR-20192012', avgConsultMinutes: 20 },
  ];

  for (const d of otherDoctors) {
    await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        role: 'doctor',
        name: d.name,
        email: d.email,
        passwordHash: doctorPasswordHash,
        verifiedAt: new Date(),
        doctor: {
          create: {
            hospitalId: hospital.id,
            specialty: d.specialty,
            licenseNo: d.licenseNo,
            licenseVerified: true,
            avgConsultMinutes: d.avgConsultMinutes,
          },
        },
      },
    });
  }

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