-- Role field (piscineiro / utilizador de campo) + User.vendorId + índice agenda por tenant/vendor.
-- Idempotente para aplicação manual em PROD (psql).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'field'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'field';
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

CREATE INDEX IF NOT EXISTS "users_vendorId_idx" ON "users" ("vendorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_vendorId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "pm_vendors"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pm_expenses_clientId_vendorId_idx" ON "pm_expenses" ("clientId", "vendorId");
