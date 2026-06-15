-- billing: campos do recebedor (Fase B.5a)
ALTER TABLE "billing_documents" ADD COLUMN "receiverName" TEXT;
ALTER TABLE "billing_documents" ADD COLUMN "receiverAddress" TEXT;
ALTER TABLE "billing_documents" ADD COLUMN "receiverEmail" TEXT;
ALTER TABLE "billing_documents" ADD COLUMN "receiverPhone" TEXT;
