-- Codificação contábil (categoria/conta) por item de conciliação = bookkeeping coding.
ALTER TABLE "bank_reconciliation_items" ADD COLUMN "category" VARCHAR(120);
