ALTER TABLE "lease_contracts"
  ADD COLUMN "monthlyRent" DECIMAL(12,2),
  ADD COLUMN "deposit" DECIMAL(12,2),
  ADD COLUMN "graceDays" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "lateFeePct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN "monthlyInterestPct" DECIMAL(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN "prorateFirstMonth" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "rent_invoices" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "contractId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'RENT',
  "monthRef" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "paidAt" TIMESTAMP(3),
  "paidAmount" DECIMAL(12,2),
  "lateFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rent_invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "rent_invoice_items" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "rent_invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rent_invoices_clientId_idx" ON "rent_invoices"("clientId");
CREATE INDEX "rent_invoices_contractId_idx" ON "rent_invoices"("contractId");
CREATE INDEX "rent_invoices_propertyId_idx" ON "rent_invoices"("propertyId");
CREATE INDEX "rent_invoices_monthRef_idx" ON "rent_invoices"("monthRef");
CREATE INDEX "rent_invoice_items_invoiceId_idx" ON "rent_invoice_items"("invoiceId");
ALTER TABLE "rent_invoice_items" ADD CONSTRAINT "rent_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "rent_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
