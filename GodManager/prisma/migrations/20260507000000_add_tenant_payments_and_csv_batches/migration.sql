-- CreateTable
CREATE TABLE "csv_batches" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2),
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "csv_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "csv_batches_contentHash_key" ON "csv_batches"("contentHash");
CREATE INDEX "csv_batches_clientId_idx" ON "csv_batches"("clientId");
CREATE INDEX "csv_batches_type_idx" ON "csv_batches"("type");

-- CreateTable
CREATE TABLE "tenant_payments" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "payerName" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "unit" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT,
    "reference" TEXT,
    "receiptAmount" DECIMAL(12,2) NOT NULL,
    "cashAccount" TEXT NOT NULL,
    "counterpartAccount" TEXT,
    "description" TEXT,
    "csvBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_payments_clientId_idx" ON "tenant_payments"("clientId");
CREATE INDEX "tenant_payments_payerName_idx" ON "tenant_payments"("payerName");
CREATE INDEX "tenant_payments_paymentDate_idx" ON "tenant_payments"("paymentDate");
CREATE INDEX "tenant_payments_csvBatchId_idx" ON "tenant_payments"("csvBatchId");
CREATE INDEX "tenant_payments_propertyId_idx" ON "tenant_payments"("propertyId");
CREATE INDEX "tenant_payments_tenantId_idx" ON "tenant_payments"("tenantId");

-- AddForeignKey
ALTER TABLE "csv_batches" ADD CONSTRAINT "csv_batches_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_csvBatchId_fkey"
    FOREIGN KEY ("csvBatchId") REFERENCES "csv_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
