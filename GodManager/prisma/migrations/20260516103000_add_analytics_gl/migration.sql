-- Enums
CREATE TYPE "GLEntryType" AS ENUM (
  'CHECK', 'RECEIPT', 'ECHECK', 'ECHECK_RECEIPT', 'PAYMENT', 'JE',
  'CC_RECEIPT', 'REVERSE_RECEIPT', 'REVERSED_ECHECK_RECEIPT',
  'BANK_TRANSFER', 'CHECK_SEND', 'OTHER'
);
CREATE TYPE "GLEntryPaidStatus" AS ENUM ('UNPAID', 'PAID', 'VOID', 'REVERSED');

-- gl_imports
CREATE TABLE "gl_imports" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceFormat" TEXT NOT NULL DEFAULT 'appfolio_gl',
  "rowCount" INTEGER NOT NULL,
  "totalDebit" DECIMAL(14,2),
  "totalCredit" DECIMAL(14,2),
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "uploadedById" TEXT,
  "uploadedBy" TEXT,
  "r2Key" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gl_imports_contentHash_key" ON "gl_imports"("contentHash");
CREATE INDEX "gl_imports_clientId_idx" ON "gl_imports"("clientId");
CREATE INDEX "gl_imports_uploadedAt_idx" ON "gl_imports"("uploadedAt");

-- gl_entries
CREATE TABLE "gl_entries" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "glImportId" TEXT NOT NULL,
  "propertyId" TEXT,
  "propertyAddress" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "payee" TEXT,
  "entryType" "GLEntryType" NOT NULL,
  "reference" TEXT,
  "debit" DECIMAL(14,2),
  "credit" DECIMAL(14,2),
  "balance" DECIMAL(14,2),
  "description" TEXT,
  "account" TEXT,
  "accountCode" TEXT,
  "paidStatus" "GLEntryPaidStatus" NOT NULL DEFAULT 'UNPAID',
  "paidAt" TIMESTAMP(3),
  "paidById" TEXT,
  "paidByName" TEXT,
  "paidMethod" TEXT,
  "paidNotes" TEXT,
  "txnHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gl_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gl_entries_clientId_txnHash_key" ON "gl_entries"("clientId", "txnHash");
CREATE INDEX "gl_entries_clientId_entryDate_idx" ON "gl_entries"("clientId", "entryDate");
CREATE INDEX "gl_entries_clientId_payee_idx" ON "gl_entries"("clientId", "payee");
CREATE INDEX "gl_entries_clientId_entryType_idx" ON "gl_entries"("clientId", "entryType");
CREATE INDEX "gl_entries_clientId_accountCode_idx" ON "gl_entries"("clientId", "accountCode");
CREATE INDEX "gl_entries_clientId_paidStatus_idx" ON "gl_entries"("clientId", "paidStatus");
CREATE INDEX "gl_entries_propertyId_idx" ON "gl_entries"("propertyId");

-- analytics_snapshots
CREATE TABLE "analytics_snapshots" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "periodYM" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "metricLabel" TEXT NOT NULL,
  "metricValue" DECIMAL(16,4),
  "metricQty" INTEGER,
  "metadata" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_snapshots_clientId_periodYM_idx" ON "analytics_snapshots"("clientId", "periodYM");
CREATE INDEX "analytics_snapshots_clientId_metricKey_idx" ON "analytics_snapshots"("clientId", "metricKey");

-- Foreign Keys
ALTER TABLE "gl_imports" ADD CONSTRAINT "gl_imports_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_glImportId_fkey"
  FOREIGN KEY ("glImportId") REFERENCES "gl_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
