-- 1099 tax fields (ADITIVO — colunas nullable, nao altera/apaga nenhum dado existente).
-- IF NOT EXISTS garante que o deploy nao quebra mesmo se rodar parcialmente.

ALTER TABLE "pm_vendors" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "pm_vendors" ADD COLUMN IF NOT EXISTS "taxIdType" TEXT;
ALTER TABLE "pm_vendors" ADD COLUMN IF NOT EXISTS "w9OnFile" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "taxIdType" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "addressStreet" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "addressCity" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "addressState" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "addressZip" TEXT;
