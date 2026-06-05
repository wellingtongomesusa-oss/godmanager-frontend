-- Pacote F: V Free flag + metadata JSON for PmExpense (calendar / reschedule history)
ALTER TABLE "pm_expenses" ADD COLUMN "isVendorFree" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pm_expenses" ADD COLUMN "metadata" JSONB;
CREATE INDEX "pm_expenses_isVendorFree_idx" ON "pm_expenses"("isVendorFree");
