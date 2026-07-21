-- RentReceiptConfirmation: confirmação de aluguel recebido por casa/mês + recibo. Aditivo/idempotente.

CREATE TABLE IF NOT EXISTS "rent_receipt_confirmations" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "propertyId" TEXT,
  "propertyKey" TEXT NOT NULL,
  "propertyLabel" TEXT NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "receivedConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "receivedAt" TIMESTAMP(3),
  "amount" DECIMAL(12,2),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "confirmedByUserId" TEXT,
  "receiptFileKey" TEXT,
  "receiptFileName" TEXT,
  "receiptSource" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rent_receipt_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rent_receipt_confirmations_clientId_propertyKey_periodMonth_key"
  ON "rent_receipt_confirmations"("clientId", "propertyKey", "periodMonth");
CREATE INDEX IF NOT EXISTS "rent_receipt_confirmations_clientId_periodMonth_idx"
  ON "rent_receipt_confirmations"("clientId", "periodMonth");
CREATE INDEX IF NOT EXISTS "rent_receipt_confirmations_clientId_propertyId_idx"
  ON "rent_receipt_confirmations"("clientId", "propertyId");

DO $$ BEGIN
  ALTER TABLE "rent_receipt_confirmations" ADD CONSTRAINT "rent_receipt_confirmations_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
