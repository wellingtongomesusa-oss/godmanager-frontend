CREATE TABLE "lease_contracts" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT,
  "code" TEXT NOT NULL,
  "moveIn" TIMESTAMP(3) NOT NULL,
  "moveOut" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lease_contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lease_contracts_clientId_idx" ON "lease_contracts"("clientId");
CREATE INDEX "lease_contracts_propertyId_idx" ON "lease_contracts"("propertyId");
CREATE INDEX "lease_contracts_tenantId_idx" ON "lease_contracts"("tenantId");
