-- CreateTable
CREATE TABLE "property_investments" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valueSource" TEXT NOT NULL DEFAULT 'manual',
    "valueUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invest_settings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "downPct" DECIMAL(6,4) NOT NULL DEFAULT 0.25,
    "rate" DECIMAL(6,4) NOT NULL DEFAULT 0.07,
    "termYears" INTEGER NOT NULL DEFAULT 30,
    "opexPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "revenueBasis" TEXT NOT NULL DEFAULT 'gross',
    "fxBrl" DECIMAL(10,4),
    "fxUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invest_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_investments_clientId_propertyId_key" ON "property_investments"("clientId", "propertyId");

-- CreateIndex
CREATE INDEX "property_investments_clientId_idx" ON "property_investments"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "invest_settings_clientId_key" ON "invest_settings"("clientId");

-- AddForeignKey
ALTER TABLE "property_investments" ADD CONSTRAINT "property_investments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invest_settings" ADD CONSTRAINT "invest_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
