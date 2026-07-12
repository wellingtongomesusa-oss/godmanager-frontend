-- Ramp → statement da casa OU despesa Manager Prop (com idempotência por transação).
CREATE TABLE "ramp_expense_postings" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rampTransactionId" TEXT NOT NULL,
  "target" VARCHAR(20) NOT NULL,
  "propertyId" TEXT,
  "yearMonth" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "merchant" TEXT,
  "description" VARCHAR(300),
  "transactionDate" TIMESTAMP(3),
  "statementLineItemId" TEXT,
  "postedById" TEXT,
  "postedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ramp_expense_postings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ramp_expense_postings_clientId_rampTransactionId_key" ON "ramp_expense_postings"("clientId", "rampTransactionId");
CREATE INDEX "ramp_expense_postings_clientId_target_idx" ON "ramp_expense_postings"("clientId", "target");
CREATE INDEX "ramp_expense_postings_propertyId_idx" ON "ramp_expense_postings"("propertyId");

ALTER TABLE "ramp_expense_postings" ADD CONSTRAINT "ramp_expense_postings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
