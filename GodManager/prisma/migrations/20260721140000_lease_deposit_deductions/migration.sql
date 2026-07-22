-- LeaseDepositDeduction: deduções do depósito de segurança na rescisão. Aditivo/idempotente.

CREATE TABLE IF NOT EXISTS "lease_deposit_deductions" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lease_deposit_deductions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lease_deposit_deductions_clientId_leaseId_idx"
  ON "lease_deposit_deductions"("clientId", "leaseId");

DO $$ BEGIN
  ALTER TABLE "lease_deposit_deductions" ADD CONSTRAINT "lease_deposit_deductions_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "lease_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
