-- Saldos bancarios manuais (snapshots por conta), multi-tenant.
-- Idempotente.

DO $$ BEGIN
  CREATE TYPE "BankAccountType" AS ENUM ('TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bank_account_balances" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "accountType" "BankAccountType" NOT NULL,
  "balance" DECIMAL(14, 2) NOT NULL,
  "balanceDate" DATE NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy" TEXT,
  CONSTRAINT "bank_account_balances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_account_balances_clientId_accountType_balanceDate_idx"
  ON "bank_account_balances"("clientId", "accountType", "balanceDate");

DO $$ BEGIN
  ALTER TABLE "bank_account_balances"
    ADD CONSTRAINT "bank_account_balances_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
