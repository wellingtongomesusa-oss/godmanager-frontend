-- AlterTable: aprovação de lançamento no statement (aguardando aprovação vs aprovado)
ALTER TABLE "statement_line_items" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "statement_line_items" ADD COLUMN "approvedBy" TEXT;

-- Backfill: lançamentos EXISTENTES ficam aprovados (não disruptar statements já em uso).
-- Só os NOVOS lançamentos entram como "aguardando aprovação" (approvedAt = NULL).
UPDATE "statement_line_items" SET "approvedAt" = "updatedAt" WHERE "approvedAt" IS NULL;
