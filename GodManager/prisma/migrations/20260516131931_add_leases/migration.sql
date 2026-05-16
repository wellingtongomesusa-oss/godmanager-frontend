CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'FUTURE', 'TERMINATED', 'UNKNOWN');

CREATE TABLE "lease_imports" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "uploadedById" TEXT,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lease_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lease_imports_contentHash_key" ON "lease_imports"("contentHash");
CREATE INDEX "lease_imports_clientId_idx" ON "lease_imports"("clientId");
CREATE INDEX "lease_imports_uploadedAt_idx" ON "lease_imports"("uploadedAt");

CREATE TABLE "leases" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "leaseImportId" TEXT NOT NULL,
  "propertyId" TEXT,
  "tenantId" TEXT,
  "propertyAddress" TEXT NOT NULL,
  "unit" TEXT,
  "tenantName" TEXT NOT NULL,
  "leaseStart" TIMESTAMP(3),
  "leaseEnd" TIMESTAMP(3),
  "monthlyRent" DECIMAL(12,2),
  "securityDeposit" DECIMAL(12,2),
  "status" "LeaseStatus" NOT NULL DEFAULT 'UNKNOWN',
  "notes" TEXT,
  "leaseHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leases_clientId_leaseHash_key" ON "leases"("clientId", "leaseHash");
CREATE INDEX "leases_clientId_status_idx" ON "leases"("clientId", "status");
CREATE INDEX "leases_clientId_leaseEnd_idx" ON "leases"("clientId", "leaseEnd");
CREATE INDEX "leases_propertyId_idx" ON "leases"("propertyId");
CREATE INDEX "leases_tenantId_idx" ON "leases"("tenantId");

ALTER TABLE "lease_imports" ADD CONSTRAINT "lease_imports_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_leaseImportId_fkey"
  FOREIGN KEY ("leaseImportId") REFERENCES "lease_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
