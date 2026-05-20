-- Snapshots Auditoria do Owner (over-payment por propriedade), multi-tenant.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "owner_audit_snapshots" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedBy" TEXT,
  "label" TEXT,
  "resultsJson" JSONB NOT NULL,
  CONSTRAINT "owner_audit_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "owner_audit_snapshots_clientId_idx" ON "owner_audit_snapshots"("clientId");

DO $$
BEGIN
  ALTER TABLE "owner_audit_snapshots"
    ADD CONSTRAINT "owner_audit_snapshots_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
