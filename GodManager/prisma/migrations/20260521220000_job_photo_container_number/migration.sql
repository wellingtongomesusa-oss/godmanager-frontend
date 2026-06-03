-- AlterTable
ALTER TABLE "job_photos" ADD COLUMN "containerNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "job_photos_jobId_containerNumber_idx" ON "job_photos"("jobId", "containerNumber");
