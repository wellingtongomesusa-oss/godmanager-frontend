-- BillingDocument: optional PDF/image attachments (R2)
ALTER TABLE "billing_documents" ADD COLUMN "attachments" JSONB;
