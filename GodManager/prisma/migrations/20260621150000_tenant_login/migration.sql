-- UserRole: tenant (valor isolado — nao usar nesta migration em colunas/constraints)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'tenant'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'tenant';
  END IF;
END $$;

-- User.tenantId -> tenants (portal login; espelho de ownerId)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenantId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
