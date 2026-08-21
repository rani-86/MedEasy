-- AlterTable: add as nullable first, since the table already has rows (the seeded hospital)
ALTER TABLE "hospitals" ADD COLUMN     "registration_id" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows with a deterministic placeholder derived from their own id, so the
-- NOT NULL + UNIQUE constraint below can be added safely. Real hospitals registering through
-- the app will overwrite this with their real registrationId; the seed script sets the
-- known value for the demo hospital explicitly afterward.
UPDATE "hospitals" SET "registration_id" = 'LEGACY-' || "id" WHERE "registration_id" IS NULL;

-- AlterTable: now safe to enforce NOT NULL
ALTER TABLE "hospitals" ALTER COLUMN "registration_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_registration_id_key" ON "hospitals"("registration_id");
