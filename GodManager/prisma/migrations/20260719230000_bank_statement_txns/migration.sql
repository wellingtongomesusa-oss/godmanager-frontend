-- Transações do extrato do banco (lado banco da conciliação) — #39 fase 3. ADITIVO.
CREATE TABLE IF NOT EXISTS "bank_statement_txns" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountKey" VARCHAR(40) NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "txnDate" DATE NOT NULL,
    "description" VARCHAR(400) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "sourceRefId" VARCHAR(80) NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_statement_txns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_statement_txns_clientId_bankAccountKey_sourceRefId_key"
    ON "bank_statement_txns"("clientId", "bankAccountKey", "sourceRefId");

CREATE INDEX IF NOT EXISTS "bank_statement_txns_clientId_bankAccountKey_periodMonth_idx"
    ON "bank_statement_txns"("clientId", "bankAccountKey", "periodMonth");

DO $$ BEGIN
    ALTER TABLE "bank_statement_txns"
        ADD CONSTRAINT "bank_statement_txns_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
