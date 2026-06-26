-- PmExpense: credit/debit party (Tenant / Owner / Manager Prop)
ALTER TABLE "pm_expenses" ADD COLUMN IF NOT EXISTS "creditParty" TEXT;
ALTER TABLE "pm_expenses" ADD COLUMN IF NOT EXISTS "debitParty" TEXT;
