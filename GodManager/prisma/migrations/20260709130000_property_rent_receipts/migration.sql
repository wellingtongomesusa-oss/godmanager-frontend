-- CreateTable
CREATE TABLE "property_rent_receipts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyKey" TEXT NOT NULL,
    "propertyLabel" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "grossReceived" DECIMAL(12,2) NOT NULL,
    "mgmtFeePct" DECIMAL(5,2) NOT NULL,
    "mgmtFeeAmount" DECIMAL(12,2) NOT NULL,
    "netOwner" DECIMAL(12,2) NOT NULL,
    "paymentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_rent_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_rent_receipts_clientId_periodMonth_idx" ON "property_rent_receipts"("clientId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "property_rent_receipts_clientId_propertyKey_periodMonth_key" ON "property_rent_receipts"("clientId", "propertyKey", "periodMonth");

-- AddForeignKey
ALTER TABLE "property_rent_receipts" ADD CONSTRAINT "property_rent_receipts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
