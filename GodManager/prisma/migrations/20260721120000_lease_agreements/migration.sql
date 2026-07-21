-- LeaseAgreement: contrato de locação autorado no GodManager (modelo Flórida). Aditivo, idempotente.

DO $$ BEGIN
  CREATE TYPE "LeaseAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED', 'RENEWED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseRentPeriod" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "lease_agreements" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "leaseNumber" INTEGER NOT NULL,
  "status" "LeaseAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "isRenewal" BOOLEAN NOT NULL DEFAULT false,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT,
  "ownerId" TEXT,
  "monthlyRent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "rentPeriod" "LeaseRentPeriod" NOT NULL DEFAULT 'MONTHLY',
  "mgmtFeePct" DECIMAL(5,2) NOT NULL DEFAULT 8,
  "tenantPlacementPct" DECIMAL(5,2),
  "lateFeeFlat" DECIMAL(12,2) NOT NULL DEFAULT 150,
  "lateFeeDaily" DECIMAL(12,2) NOT NULL DEFAULT 5,
  "securityDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "securityReserve" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "is1099" BOOLEAN NOT NULL DEFAULT false,
  "guaranteeType" TEXT NOT NULL DEFAULT 'SECURITY_DEPOSIT',
  "hoaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "hoaValue" DECIMAL(12,2),
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "durationMonths" INTEGER,
  "moveOutDate" TIMESTAMP(3),
  "attorneySentAt" TIMESTAMP(3),
  "qbInvoiceId" TEXT,
  "qbInvoiceUrl" TEXT,
  "leaseForm" JSONB,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lease_agreements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lease_agreements_clientId_leaseNumber_key" ON "lease_agreements"("clientId", "leaseNumber");
CREATE INDEX IF NOT EXISTS "lease_agreements_clientId_status_idx" ON "lease_agreements"("clientId", "status");
CREATE INDEX IF NOT EXISTS "lease_agreements_clientId_propertyId_idx" ON "lease_agreements"("clientId", "propertyId");
CREATE INDEX IF NOT EXISTS "lease_agreements_propertyId_idx" ON "lease_agreements"("propertyId");
CREATE INDEX IF NOT EXISTS "lease_agreements_tenantId_idx" ON "lease_agreements"("tenantId");

DO $$ BEGIN
  ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
