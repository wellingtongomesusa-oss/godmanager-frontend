-- Pipeline de orcamento (RFQ): roles supervisor/vendor + tabela job_bids.
-- Idempotente (psql manual e prisma migrate deploy).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='UserRole' AND e.enumlabel='supervisor') THEN
    ALTER TYPE "UserRole" ADD VALUE 'supervisor';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='UserRole' AND e.enumlabel='vendor') THEN
    ALTER TYPE "UserRole" ADD VALUE 'vendor';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "job_bids" (
  "id" TEXT PRIMARY KEY,
  "expenseId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "clientId" TEXT,
  "invitedById" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadline" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2),
  "invoiceR2Key" TEXT,
  "invoiceUrl" TEXT,
  "invoiceMime" TEXT,
  "submittedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'invited',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_bids_expenseId_vendorId_key" ON "job_bids" ("expenseId","vendorId");
CREATE INDEX IF NOT EXISTS "job_bids_expenseId_idx" ON "job_bids" ("expenseId");
CREATE INDEX IF NOT EXISTS "job_bids_vendorId_idx" ON "job_bids" ("vendorId");
CREATE INDEX IF NOT EXISTS "job_bids_status_idx" ON "job_bids" ("status");
CREATE INDEX IF NOT EXISTS "job_bids_deadline_idx" ON "job_bids" ("deadline");
CREATE INDEX IF NOT EXISTS "job_bids_clientId_idx" ON "job_bids" ("clientId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_bids_expenseId_fkey') THEN
    ALTER TABLE "job_bids" ADD CONSTRAINT "job_bids_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "pm_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_bids_vendorId_fkey') THEN
    ALTER TABLE "job_bids" ADD CONSTRAINT "job_bids_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "pm_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
