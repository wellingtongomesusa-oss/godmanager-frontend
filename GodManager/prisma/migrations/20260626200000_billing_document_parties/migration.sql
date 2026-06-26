-- BillingDocument: credit/debit party (Tenant / Owner / Manager Prop)
ALTER TABLE "billing_documents" ADD COLUMN "creditParty" TEXT;
ALTER TABLE "billing_documents" ADD COLUMN "debitParty" TEXT;
