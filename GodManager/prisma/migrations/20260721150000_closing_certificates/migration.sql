-- ClosingCertificate: termo de conferido do fechamento mensal (Broker assina). Aditivo/idempotente.

CREATE TABLE IF NOT EXISTS "closing_certificates" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "signerName" TEXT,
  "signerRole" TEXT,
  "signedByUserId" TEXT,
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "closing_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "closing_certificates_clientId_yearMonth_key"
  ON "closing_certificates"("clientId", "yearMonth");
CREATE INDEX IF NOT EXISTS "closing_certificates_clientId_yearMonth_idx"
  ON "closing_certificates"("clientId", "yearMonth");

DO $$ BEGIN
  ALTER TABLE "closing_certificates" ADD CONSTRAINT "closing_certificates_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
