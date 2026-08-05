-- CreateEnum
CREATE TYPE "BedCategory" AS ENUM ('icu', 'general', 'maternity', 'isolation', 'emergency');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('vacant', 'occupied', 'reserved', 'cleaning');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hospital_id" TEXT;

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "category" "BedCategory" NOT NULL,
    "bed_number" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'vacant',
    "current_patient_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_admissions" (
    "id" TEXT NOT NULL,
    "bed_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "admitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharged_at" TIMESTAMP(3),

    CONSTRAINT "bed_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beds_hospital_id_category_status_idx" ON "beds"("hospital_id", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_hospital_id_bed_number_key" ON "beds"("hospital_id", "bed_number");

-- CreateIndex
CREATE INDEX "bed_admissions_patient_id_admitted_at_idx" ON "bed_admissions"("patient_id", "admitted_at");

-- CreateIndex
CREATE INDEX "bed_admissions_bed_id_idx" ON "bed_admissions"("bed_id");

-- CreateIndex
CREATE INDEX "users_hospital_id_idx" ON "users"("hospital_id");

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_admissions" ADD CONSTRAINT "bed_admissions_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_admissions" ADD CONSTRAINT "bed_admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
