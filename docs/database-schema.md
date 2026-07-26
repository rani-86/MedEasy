# Medeasy — PostgreSQL Schema Design

**Version:** 1.0
**Companion to:** Medeasy PRD v1.0 + System Architecture v1.0
**Status:** Draft for Engineering Review
**Date:** July 2026

> The ER diagram for this schema was rendered separately in-conversation. This document contains the full DDL, relationships, indexes, Prisma models, constraints, and sample seed data.

---

## 1. ER Diagram

See the rendered entity-relationship diagram above. Entity summary:

- `users` → 1:1 → `patient_profiles` (when role = patient)
- `users` → 1:1 → `doctors` (when role = doctor)
- `hospitals` → 1:N → `doctors`, `beds`, `inventory_items`, `appointments`
- `patient_profiles` → 1:N → `appointments`, `bed_admissions`
- `doctors` → 1:N → `appointments`
- `appointments` → 1:1 → `prescriptions`
- `beds` → 1:N → `bed_admissions`
- `inventory_items` → 1:N → `purchase_orders`
- `suppliers` → 1:N → `purchase_orders`

---

## 2. Tables (DDL)

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- USERS
-- =========================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    email           VARCHAR(255) UNIQUE,
    password_hash   TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at     TIMESTAMPTZ,
    CONSTRAINT chk_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- =========================================
-- PATIENT PROFILES
-- =========================================
CREATE TABLE patient_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    dob                 DATE,
    blood_group         VARCHAR(5),
    allergies           TEXT[],
    emergency_contact   VARCHAR(20),
    guardian_id         UUID REFERENCES patient_profiles(id), -- for dependents
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- HOSPITALS
-- =========================================
CREATE TABLE hospitals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id      UUID, -- nullable, groups branches of the same chain
    name            VARCHAR(200) NOT NULL,
    address         TEXT NOT NULL,
    lat             NUMERIC(9,6) NOT NULL,
    lng             NUMERIC(9,6) NOT NULL,
    departments     TEXT[],
    contact_phone   VARCHAR(20),
    rating_avg      NUMERIC(2,1) DEFAULT 0.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- DOCTORS
-- =========================================
CREATE TABLE doctors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    specialty           VARCHAR(100) NOT NULL,
    license_no          VARCHAR(50) NOT NULL UNIQUE,
    license_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    avg_consult_minutes INTEGER NOT NULL DEFAULT 15 CHECK (avg_consult_minutes > 0),
    rating_avg          NUMERIC(2,1) DEFAULT 0.0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- APPOINTMENTS
-- =========================================
CREATE TABLE appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    hospital_id     UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    slot_start      TIMESTAMPTZ NOT NULL,
    slot_end        TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'booked'
                        CHECK (status IN ('booked','completed','cancelled','no_show')),
    queue_position  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_slot_order CHECK (slot_end > slot_start)
);

-- =========================================
-- PRESCRIPTIONS
-- =========================================
CREATE TABLE prescriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id      UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    notes           TEXT,
    medicines       JSONB NOT NULL DEFAULT '[]', -- [{name, dosage, duration}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- BEDS
-- =========================================
CREATE TABLE beds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    category            VARCHAR(20) NOT NULL
                            CHECK (category IN ('icu','general','maternity','isolation','emergency')),
    bed_number          VARCHAR(20) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'vacant'
                            CHECK (status IN ('vacant','occupied','reserved','cleaning')),
    current_patient_id  UUID REFERENCES patient_profiles(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, bed_number)
);

-- =========================================
-- BED ADMISSIONS
-- =========================================
CREATE TABLE bed_admissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_id          UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    patient_id      UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    admitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    discharged_at   TIMESTAMPTZ,
    CONSTRAINT chk_discharge_after_admit CHECK (discharged_at IS NULL OR discharged_at > admitted_at)
);

-- =========================================
-- INVENTORY ITEMS
-- =========================================
CREATE TABLE inventory_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    item_name           VARCHAR(150) NOT NULL,
    category            VARCHAR(50) NOT NULL, -- medicine / consumable / equipment
    unit                VARCHAR(20) NOT NULL,
    current_stock       INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    reorder_threshold   INTEGER NOT NULL DEFAULT 10 CHECK (reorder_threshold >= 0),
    expiry_date         DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, item_name, expiry_date)
);

-- =========================================
-- SUPPLIERS
-- =========================================
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    contact_phone   VARCHAR(20),
    contact_email   VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- PURCHASE ORDERS
-- =========================================
CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','shipped','received','cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Relationships

| Parent | Child | Type | Delete Rule | Notes |
|---|---|---|---|---|
| `users` | `patient_profiles` | 1:1 | CASCADE | one profile per patient user |
| `users` | `doctors` | 1:1 | CASCADE | one doctor record per doctor user |
| `hospitals` | `doctors` | 1:N | RESTRICT | can't delete hospital with active doctors |
| `hospitals` | `beds` | 1:N | CASCADE | beds belong entirely to hospital |
| `hospitals` | `inventory_items` | 1:N | CASCADE | stock belongs entirely to hospital |
| `hospitals` | `appointments` | 1:N | RESTRICT | preserve appointment history |
| `hospitals` | `purchase_orders` | 1:N | CASCADE | POs belong to hospital |
| `patient_profiles` | `appointments` | 1:N | CASCADE | patient's booking history |
| `patient_profiles` | `bed_admissions` | 1:N | RESTRICT | preserve admission history |
| `patient_profiles` | `patient_profiles` (self) | 1:N | — | `guardian_id` links dependents to a primary account |
| `doctors` | `appointments` | 1:N | RESTRICT | preserve doctor's consult history |
| `appointments` | `prescriptions` | 1:1 | CASCADE | prescription tied to one visit |
| `beds` | `bed_admissions` | 1:N | RESTRICT | historical admission log per bed |
| `inventory_items` | `purchase_orders` | 1:N | RESTRICT | preserve reorder audit trail |
| `suppliers` | `purchase_orders` | 1:N | RESTRICT | preserve supplier order history |

**Design note:** Deletions on operational history tables (`appointments`, `bed_admissions`, `purchase_orders`) use `RESTRICT` rather than `CASCADE` deliberately — hospitals, doctors, and patients should be deactivated (`is_active = false`), not hard-deleted, to preserve medical and audit history.

---

## 4. Indexes

```sql
-- Users: fast lookup on login identifiers
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;

-- Doctors: hospital roster lookups, specialty search
CREATE INDEX idx_doctors_hospital ON doctors (hospital_id);
CREATE INDEX idx_doctors_specialty ON doctors (specialty);

-- Hospitals: geo lookups (paired with PostGIS in production for true geo-radius queries)
CREATE INDEX idx_hospitals_latlng ON hospitals (lat, lng);
CREATE INDEX idx_hospitals_network ON hospitals (network_id) WHERE network_id IS NOT NULL;

-- Appointments: conflict checks + doctor's daily queue + patient history
CREATE UNIQUE INDEX idx_appt_doctor_slot ON appointments (doctor_id, slot_start)
    WHERE status = 'booked'; -- prevents double-booking at DB level
CREATE INDEX idx_appt_patient ON appointments (patient_id, slot_start DESC);
CREATE INDEX idx_appt_hospital_date ON appointments (hospital_id, slot_start);
CREATE INDEX idx_appt_status ON appointments (status);

-- Beds: real-time availability queries (the hottest read path)
CREATE INDEX idx_beds_hospital_category_status ON beds (hospital_id, category, status);

-- Bed admissions: active admission lookup, patient history
CREATE INDEX idx_bed_admissions_bed ON bed_admissions (bed_id);
CREATE INDEX idx_bed_admissions_patient ON bed_admissions (patient_id, admitted_at DESC);
CREATE INDEX idx_bed_admissions_active ON bed_admissions (bed_id) WHERE discharged_at IS NULL;

-- Inventory: reorder threshold scans, expiry alerts
CREATE INDEX idx_inventory_hospital_stock ON inventory_items (hospital_id, current_stock);
CREATE INDEX idx_inventory_expiry ON inventory_items (expiry_date) WHERE expiry_date IS NOT NULL;

-- Purchase orders: supplier/status tracking
CREATE INDEX idx_po_hospital_status ON purchase_orders (hospital_id, status);
CREATE INDEX idx_po_item ON purchase_orders (item_id);

-- Prescriptions: patient medical history retrieval
CREATE INDEX idx_prescriptions_patient ON prescriptions (patient_id, created_at DESC);
```

**Partitioning note:** `appointments` should be range-partitioned by `slot_start` (monthly) once volume grows past a few million rows, to keep the hot partition (current month) small and speed up both writes and the conflict-check index.

---

## 5. Prisma Models

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  patient
  doctor
  admin
}

enum AppointmentStatus {
  booked
  completed
  cancelled
  no_show
}

enum BedCategory {
  icu
  general
  maternity
  isolation
  emergency
}

enum BedStatus {
  vacant
  occupied
  reserved
  cleaning
}

enum PurchaseOrderStatus {
  pending
  approved
  shipped
  received
  cancelled
}

model User {
  id            String    @id @default(uuid())
  role          UserRole
  name          String
  phone         String?   @unique
  email         String?   @unique
  passwordHash  String?   @map("password_hash")
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  verifiedAt    DateTime? @map("verified_at")

  patientProfile PatientProfile?
  doctor         Doctor?

  @@map("users")
}

model PatientProfile {
  id                String    @id @default(uuid())
  userId            String    @unique @map("user_id")
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  dob               DateTime? @db.Date
  bloodGroup        String?   @map("blood_group")
  allergies         String[]
  emergencyContact  String?   @map("emergency_contact")
  guardianId        String?   @map("guardian_id")
  guardian          PatientProfile?  @relation("Dependents", fields: [guardianId], references: [id])
  dependents        PatientProfile[] @relation("Dependents")
  createdAt         DateTime  @default(now()) @map("created_at")

  appointments      Appointment[]
  bedAdmissions     BedAdmission[]
  prescriptions     Prescription[]

  @@map("patient_profiles")
}

model Hospital {
  id            String    @id @default(uuid())
  networkId     String?   @map("network_id")
  name          String
  address       String
  lat           Decimal   @db.Decimal(9, 6)
  lng           Decimal   @db.Decimal(9, 6)
  departments   String[]
  contactPhone  String?   @map("contact_phone")
  ratingAvg     Decimal   @default(0.0) @map("rating_avg") @db.Decimal(2, 1)
  createdAt     DateTime  @default(now()) @map("created_at")

  doctors         Doctor[]
  beds            Bed[]
  inventoryItems  InventoryItem[]
  appointments    Appointment[]
  purchaseOrders  PurchaseOrder[]

  @@map("hospitals")
}

model Doctor {
  id                 String   @id @default(uuid())
  userId             String   @unique @map("user_id")
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  hospitalId         String   @map("hospital_id")
  hospital           Hospital @relation(fields: [hospitalId], references: [id])
  specialty          String
  licenseNo          String   @unique @map("license_no")
  licenseVerified    Boolean  @default(false) @map("license_verified")
  avgConsultMinutes  Int      @default(15) @map("avg_consult_minutes")
  ratingAvg          Decimal  @default(0.0) @map("rating_avg") @db.Decimal(2, 1)
  createdAt          DateTime @default(now()) @map("created_at")

  appointments  Appointment[]
  prescriptions Prescription[]

  @@index([hospitalId])
  @@index([specialty])
  @@map("doctors")
}

model Appointment {
  id            String             @id @default(uuid())
  patientId     String             @map("patient_id")
  patient       PatientProfile     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctorId      String             @map("doctor_id")
  doctor        Doctor             @relation(fields: [doctorId], references: [id])
  hospitalId    String             @map("hospital_id")
  hospital      Hospital           @relation(fields: [hospitalId], references: [id])
  slotStart     DateTime           @map("slot_start")
  slotEnd       DateTime           @map("slot_end")
  status        AppointmentStatus  @default(booked)
  queuePosition Int?               @map("queue_position")
  createdAt     DateTime           @default(now()) @map("created_at")

  prescription  Prescription?

  @@unique([doctorId, slotStart], name: "uq_doctor_slot")
  @@index([patientId, slotStart])
  @@index([hospitalId, slotStart])
  @@map("appointments")
}

model Prescription {
  id             String       @id @default(uuid())
  appointmentId  String       @unique @map("appointment_id")
  appointment    Appointment  @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  doctorId       String       @map("doctor_id")
  doctor         Doctor       @relation(fields: [doctorId], references: [id])
  patientId      String       @map("patient_id")
  patient        PatientProfile @relation(fields: [patientId], references: [id])
  notes          String?
  medicines      Json         @default("[]")
  createdAt      DateTime     @default(now()) @map("created_at")

  @@map("prescriptions")
}

model Bed {
  id                 String     @id @default(uuid())
  hospitalId         String     @map("hospital_id")
  hospital           Hospital   @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  category           BedCategory
  bedNumber          String     @map("bed_number")
  status             BedStatus  @default(vacant)
  currentPatientId   String?    @map("current_patient_id")
  updatedAt          DateTime   @default(now()) @map("updated_at")

  admissions  BedAdmission[]

  @@unique([hospitalId, bedNumber])
  @@index([hospitalId, category, status])
  @@map("beds")
}

model BedAdmission {
  id            String    @id @default(uuid())
  bedId         String    @map("bed_id")
  bed           Bed       @relation(fields: [bedId], references: [id])
  patientId     String    @map("patient_id")
  patient       PatientProfile @relation(fields: [patientId], references: [id])
  admittedAt    DateTime  @default(now()) @map("admitted_at")
  dischargedAt  DateTime? @map("discharged_at")

  @@index([patientId, admittedAt])
  @@map("bed_admissions")
}

model InventoryItem {
  id                String    @id @default(uuid())
  hospitalId        String    @map("hospital_id")
  hospital          Hospital  @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  itemName          String    @map("item_name")
  category          String
  unit              String
  currentStock      Int       @default(0) @map("current_stock")
  reorderThreshold  Int       @default(10) @map("reorder_threshold")
  expiryDate        DateTime? @map("expiry_date") @db.Date
  updatedAt         DateTime  @default(now()) @map("updated_at")

  purchaseOrders  PurchaseOrder[]

  @@unique([hospitalId, itemName, expiryDate])
  @@index([hospitalId, currentStock])
  @@map("inventory_items")
}

model Supplier {
  id            String   @id @default(uuid())
  name          String
  contactPhone  String?  @map("contact_phone")
  contactEmail  String?  @map("contact_email")
  createdAt     DateTime @default(now()) @map("created_at")

  purchaseOrders PurchaseOrder[]

  @@map("suppliers")
}

model PurchaseOrder {
  id          String               @id @default(uuid())
  hospitalId  String               @map("hospital_id")
  hospital    Hospital             @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  itemId      String               @map("item_id")
  item        InventoryItem        @relation(fields: [itemId], references: [id])
  supplierId  String               @map("supplier_id")
  supplier    Supplier             @relation(fields: [supplierId], references: [id])
  quantity    Int
  status      PurchaseOrderStatus  @default(pending)
  createdAt   DateTime             @default(now()) @map("created_at")

  @@index([hospitalId, status])
  @@map("purchase_orders")
}
```

---

## 6. Constraints

| Constraint | Table | Rule | Rationale |
|---|---|---|---|
| `chk_contact` | `users` | phone OR email must be present | every account needs a reachable contact method |
| `role IN (...)` | `users` | role restricted to patient/doctor/admin | prevents invalid role values |
| `chk_slot_order` | `appointments` | `slot_end > slot_start` | prevents zero/negative-duration bookings |
| `idx_appt_doctor_slot` (unique, partial) | `appointments` | no two `booked` rows share (doctor_id, slot_start) | DB-level double-booking prevention, not just app-level locking |
| `status IN (...)` | `appointments`, `beds`, `purchase_orders` | enum-like value restriction via CHECK | data integrity without a separate lookup table |
| `chk_discharge_after_admit` | `bed_admissions` | discharge must be after admission | prevents invalid time ranges |
| `current_stock >= 0` | `inventory_items` | stock can't go negative | catches race-condition bugs in deduction logic at the DB layer |
| `UNIQUE (hospital_id, bed_number)` | `beds` | bed numbers unique per hospital | prevents duplicate bed identifiers |
| `UNIQUE (license_no)` | `doctors` | one license number per doctor | prevents duplicate/fraudulent doctor accounts |
| `quantity > 0` | `purchase_orders` | POs must order a positive quantity | prevents nonsensical zero/negative orders |
| `ON DELETE RESTRICT` (multiple) | appointments, bed_admissions, purchase_orders, doctors | blocks deletion of referenced parent rows | preserves medical/audit history — deactivate instead of delete |

**Application-layer constraints (not enforced by Postgres, but required in service logic):**
- A doctor with `license_verified = false` should be blocked from accepting appointments (enforced in the Appointment Service, not the DB, since it's a business-workflow rule rather than a structural one).
- Bed reservation → occupied transitions should go through the "cleaning" intermediate state before re-allocation (state machine enforced in the Bed Management Service).

---

## 7. Sample Data

```sql
-- Hospitals
INSERT INTO hospitals (id, name, address, lat, lng, departments, contact_phone, rating_avg) VALUES
('11111111-1111-1111-1111-111111111111', 'Apex Multispecialty Hospital', 'Boring Road, Patna, Bihar', 25.612200, 85.133500,
 ARRAY['Cardiology','Orthopedics','General Medicine','Emergency'], '+916120001111', 4.3),
('22222222-2222-2222-2222-222222222222', 'Sunrise Care Hospital', 'Bailey Road, Patna, Bihar', 25.628500, 85.099900,
 ARRAY['Pediatrics','Gynecology','Emergency'], '+916120002222', 4.1);

-- Users (patients, doctors, admin)
INSERT INTO users (id, role, name, phone, email, password_hash, verified_at) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', 'patient', 'Rohit Kumar', '+919000000001', 'rohit.k@example.com', NULL, now()),
('aaaaaaaa-0000-0000-0000-000000000002', 'doctor',  'Dr. Anjali Sharma', '+919000000002', 'anjali.sharma@apex.com', 'hashed_pw', now()),
('aaaaaaaa-0000-0000-0000-000000000003', 'admin',   'Suresh Prasad', '+919000000003', 'suresh.p@apex.com', 'hashed_pw', now());

-- Patient profile
INSERT INTO patient_profiles (id, user_id, dob, blood_group, allergies, emergency_contact) VALUES
('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1996-04-12', 'O+', ARRAY['Penicillin'], '+919000009999');

-- Doctor
INSERT INTO doctors (id, user_id, hospital_id, specialty, license_no, license_verified, avg_consult_minutes, rating_avg) VALUES
('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 'Cardiology', 'MCI-BR-20191234', TRUE, 20, 4.6);

-- Appointment
INSERT INTO appointments (id, patient_id, doctor_id, hospital_id, slot_start, slot_end, status) VALUES
('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
 '11111111-1111-1111-1111-111111111111', '2026-07-23 10:00:00+05:30', '2026-07-23 10:20:00+05:30', 'booked');

-- Beds
INSERT INTO beds (id, hospital_id, category, bed_number, status) VALUES
('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'icu', 'ICU-01', 'vacant'),
('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'general', 'GEN-14', 'occupied');

-- Inventory
INSERT INTO inventory_items (id, hospital_id, item_name, category, unit, current_stock, reorder_threshold, expiry_date) VALUES
('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Paracetamol 500mg', 'medicine', 'strip', 240, 50, '2027-03-01'),
('ffffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'IV Cannula 18G', 'consumable', 'unit', 8, 20, NULL);

-- Supplier + Purchase Order (triggered by low stock on IV Cannula, below its threshold of 20)
INSERT INTO suppliers (id, name, contact_phone, contact_email) VALUES
('99999999-0000-0000-0000-000000000001', 'MedSupply Distributors Pvt Ltd', '+916120005555', 'orders@medsupply.example.com');

INSERT INTO purchase_orders (id, hospital_id, item_id, supplier_id, quantity, status) VALUES
('88888888-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'ffffffff-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 100, 'pending');
```

---

*End of Document*
