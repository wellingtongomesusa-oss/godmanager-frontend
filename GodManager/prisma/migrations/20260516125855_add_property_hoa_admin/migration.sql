-- AlterTable
ALTER TABLE "properties" ADD COLUMN "hoaAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "properties_hoaAdmin_idx" ON "properties"("hoaAdmin");
