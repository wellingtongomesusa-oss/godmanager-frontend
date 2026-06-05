-- F5: flag reagendamento sem alterar PmExpenseStatus
ALTER TABLE "pm_expenses" ADD COLUMN "wasRescheduled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "pm_expenses_wasRescheduled_idx" ON "pm_expenses"("wasRescheduled");
