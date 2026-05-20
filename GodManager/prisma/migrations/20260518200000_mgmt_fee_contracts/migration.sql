-- Auditoria GL 2026: % contratada de fee por texto de propriedade (CSV), sem usar tabela properties.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "mgmt_fee_contracts" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "propertyKey" TEXT NOT NULL,
  "contractedPct" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT,
  CONSTRAINT "mgmt_fee_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mgmt_fee_contracts_clientId_propertyKey_key"
  ON "mgmt_fee_contracts"("clientId", "propertyKey");

CREATE INDEX IF NOT EXISTS "mgmt_fee_contracts_clientId_idx"
  ON "mgmt_fee_contracts"("clientId");

DO $$
BEGIN
  ALTER TABLE "mgmt_fee_contracts"
    ADD CONSTRAINT "mgmt_fee_contracts_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
