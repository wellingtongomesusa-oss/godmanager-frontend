CREATE TABLE "hoa_charges" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "propertyId" TEXT,
  "code" TEXT NOT NULL,
  "hoaName" TEXT,
  "debtorName" TEXT,
  "monthlyAmount" DECIMAL(12,2) NOT NULL,
  "installmentsCount" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hoa_charges_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hoa_installments" (
  "id" TEXT NOT NULL,
  "hoaChargeId" TEXT NOT NULL,
  "clientId" TEXT,
  "seq" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paidAt" TIMESTAMP(3),
  "paidAmount" DECIMAL(12,2),
  "pmExpenseId" TEXT,
  "notes" TEXT,
  CONSTRAINT "hoa_installments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hoa_charges_clientId_idx" ON "hoa_charges"("clientId");
CREATE INDEX "hoa_charges_propertyId_idx" ON "hoa_charges"("propertyId");
CREATE INDEX "hoa_installments_hoaChargeId_idx" ON "hoa_installments"("hoaChargeId");
CREATE INDEX "hoa_installments_clientId_idx" ON "hoa_installments"("clientId");
ALTER TABLE "hoa_installments" ADD CONSTRAINT "hoa_installments_hoaChargeId_fkey" FOREIGN KEY ("hoaChargeId") REFERENCES "hoa_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
