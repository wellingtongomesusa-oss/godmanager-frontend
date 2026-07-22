-- contractCode no LeaseAgreement (CTGD+data+casa+2 letras). Aditivo/idempotente.
ALTER TABLE "lease_agreements" ADD COLUMN IF NOT EXISTS "contractCode" TEXT;
CREATE INDEX IF NOT EXISTS "lease_agreements_clientId_contractCode_idx" ON "lease_agreements"("clientId", "contractCode");
