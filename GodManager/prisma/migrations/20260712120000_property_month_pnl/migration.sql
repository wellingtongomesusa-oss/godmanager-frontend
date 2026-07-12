-- CreateTable
CREATE TABLE "property_month_pnl" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyKey" TEXT NOT NULL,
    "propertyLabel" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "income" DECIMAL(12,2) NOT NULL,
    "expenses" DECIMAL(12,2) NOT NULL,
    "mgmtFee" DECIMAL(12,2) NOT NULL,
    "netOwner" DECIMAL(12,2) NOT NULL,
    "byCategory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_month_pnl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_month_pnl_clientId_periodMonth_idx" ON "property_month_pnl"("clientId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "property_month_pnl_clientId_propertyKey_periodMonth_key" ON "property_month_pnl"("clientId", "propertyKey", "periodMonth");

-- AddForeignKey
ALTER TABLE "property_month_pnl" ADD CONSTRAINT "property_month_pnl_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
