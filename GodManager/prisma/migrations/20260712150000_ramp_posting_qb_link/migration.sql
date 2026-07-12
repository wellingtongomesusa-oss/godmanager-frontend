-- Vínculo do lançamento Ramp com a entidade criada no QuickBooks (Purchase/Bill).
ALTER TABLE "ramp_expense_postings" ADD COLUMN "qbEntityType" VARCHAR(20);
ALTER TABLE "ramp_expense_postings" ADD COLUMN "qbEntityId" TEXT;
