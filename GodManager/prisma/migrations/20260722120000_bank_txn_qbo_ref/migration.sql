-- Rastreio do lançamento criado no QuickBooks pelo robô (Caminho B)
ALTER TABLE "bank_statement_txns" ADD COLUMN IF NOT EXISTS "matchedQboId" VARCHAR(40);
ALTER TABLE "bank_statement_txns" ADD COLUMN IF NOT EXISTS "matchedQboType" VARCHAR(20);
