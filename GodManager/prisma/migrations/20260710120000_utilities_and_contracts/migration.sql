-- CreateTable
CREATE TABLE "utility_accounts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "accountNumber" TEXT,
    "login" TEXT,
    "passwordEnc" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_contracts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "utility_accounts_clientId_propertyId_idx" ON "utility_accounts"("clientId", "propertyId");

-- CreateIndex
CREATE INDEX "property_contracts_clientId_propertyId_idx" ON "property_contracts"("clientId", "propertyId");

-- AddForeignKey
ALTER TABLE "utility_accounts" ADD CONSTRAINT "utility_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_accounts" ADD CONSTRAINT "utility_accounts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_contracts" ADD CONSTRAINT "property_contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_contracts" ADD CONSTRAINT "property_contracts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
