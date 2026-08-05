import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);
const BASE_URL = 'http://localhost:4000';
const BED_ID = 'a142cf04-2985-4c1d-8ba8-5d7fa0a3d98e';
const PATIENT_ID = '549bebca-e310-47ce-a61d-e958b450a0c4';

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'suresh.p@apex.com' } });
  const secret = authenticator.generateSecret();
  await redis.set(`admin:totp_secret:${admin.id}`, secret);
  const totpCode = authenticator.generate(secret);

  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'suresh.p@apex.com', password: 'AdminPass123!', totpCode }),
  });
  const loginData: any = await loginRes.json();
  if (!loginRes.ok) {
    console.error('LOGIN FAILED:', loginData);
    process.exit(1);
  }
  const token = loginData.data.accessToken;
  console.log('✓ Logged in as admin\n');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  let bedRes = await fetch(`${BASE_URL}/api/v1/beds/${BED_ID}`, { headers });
  let bedData: any = await bedRes.json();
  let bed = bedData.data;
  console.log('Current bed status:', bed.status);

  if (bed.status === 'vacant') {
    console.log('\n→ Allocating...');
    bedRes = await fetch(`${BASE_URL}/api/v1/beds/${BED_ID}/allocate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    bedData = await bedRes.json();
    console.log(bedData);
    bed = bedData.data;
  }

  if (bed.status === 'occupied') {
    console.log('\n→ Discharging...');
    bedRes = await fetch(`${BASE_URL}/api/v1/beds/${BED_ID}/discharge`, { method: 'PATCH', headers });
    bedData = await bedRes.json();
    console.log(bedData);
    bed = bedData.data;
  }

  if (bed.status === 'cleaning') {
    console.log('\n→ Marking cleaned...');
    bedRes = await fetch(`${BASE_URL}/api/v1/beds/${BED_ID}/mark-cleaned`, { method: 'PATCH', headers });
    bedData = await bedRes.json();
    console.log(bedData);
    bed = bedData.data;
  }

  if (bed.status === 'vacant') {
    console.log('\n→ Re-allocating to prove the full cycle...');
    bedRes = await fetch(`${BASE_URL}/api/v1/beds/${BED_ID}/allocate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    bedData = await bedRes.json();
    console.log(bedData);
  }

  console.log('\n✓ Full cycle test complete.');
}

main()
  .catch((err) => console.error('SCRIPT ERROR:', err))
  .finally(() => {
    prisma.$disconnect();
    redis.disconnect();
  });