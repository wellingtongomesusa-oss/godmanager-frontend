-- Numeração de job por cliente: prefixo + contador atômico em clients, jobNumber em pm_expenses.
-- Idempotente para aplicação manual em PROD (psql) e via prisma migrate deploy.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "jobPrefix" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "lastJobNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pm_expenses" ADD COLUMN IF NOT EXISTS "jobNumber" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "pm_expenses_clientId_jobNumber_key"
  ON "pm_expenses" ("clientId", "jobNumber");
