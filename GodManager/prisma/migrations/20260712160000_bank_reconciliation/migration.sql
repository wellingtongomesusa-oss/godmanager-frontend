-- Conciliação bancária: por conta + mês, saldo do extrato vs itens "cleared".
CREATE TABLE "bank_reconciliations" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "bankAccountKey" VARCHAR(40) NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "statementBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "reconciledBy" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_reconciliations_clientId_bankAccountKey_periodMonth_key" ON "bank_reconciliations"("clientId", "bankAccountKey", "periodMonth");
CREATE INDEX "bank_reconciliations_clientId_status_idx" ON "bank_reconciliations"("clientId", "status");

ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bank_reconciliation_items" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "txnDate" TIMESTAMP(3),
  "sourceType" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  "sourceRefId" TEXT,
  "cleared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_reconciliation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_reconciliation_items_reconciliationId_idx" ON "bank_reconciliation_items"("reconciliationId");

ALTER TABLE "bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
