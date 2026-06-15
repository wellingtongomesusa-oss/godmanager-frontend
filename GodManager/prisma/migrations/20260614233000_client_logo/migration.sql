-- client: campos de logo da empresa (Fase 2a)
-- logoUrl já existe (migration 20260504192611_f4_owner_portal_schema)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "clients" ADD COLUMN "logoKey" TEXT;
