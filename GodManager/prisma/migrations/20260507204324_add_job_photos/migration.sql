CREATE TABLE "job_photos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "clientId" TEXT,
  "r2Key" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "filename" TEXT,
  "sizeBytes" INTEGER,
  "contentType" TEXT,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_photos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "job_photos_r2Key_key" ON "job_photos"("r2Key");
CREATE INDEX "job_photos_jobId_idx" ON "job_photos"("jobId");
CREATE INDEX "job_photos_clientId_idx" ON "job_photos"("clientId");
CREATE INDEX "job_photos_uploadedAt_idx" ON "job_photos"("uploadedAt");
