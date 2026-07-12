-- Vínculo do lançamento Ramp com o PmExpense casado (job pago via Ramp), p/ não casar 2x.
ALTER TABLE "ramp_expense_postings" ADD COLUMN "matchedExpenseId" TEXT;
CREATE INDEX "ramp_expense_postings_matchedExpenseId_idx" ON "ramp_expense_postings"("matchedExpenseId");
