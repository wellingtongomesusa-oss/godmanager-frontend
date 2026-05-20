-- Manual migration: snapshots da Auditoria GL 2026 (totais + série mensal + por propriedade).
-- Idempotente para reaplicação em PROD quando necessário.

CREATE TABLE IF NOT EXISTS "gl_audit_snapshots" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedBy" TEXT,
  "label" TEXT,
  "periodStart" TEXT,
  "periodEnd" TEXT,
  "totalsJson" JSONB NOT NULL,
  "monthlyJson" JSONB NOT NULL,
  "perPropertyJson" JSONB NOT NULL,
  CONSTRAINT "gl_audit_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gl_audit_snapshots_clientId_idx" ON "gl_audit_snapshots"("clientId");

DO $$
BEGIN
  ALTER TABLE "gl_audit_snapshots"
    ADD CONSTRAINT "gl_audit_snapshots_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
