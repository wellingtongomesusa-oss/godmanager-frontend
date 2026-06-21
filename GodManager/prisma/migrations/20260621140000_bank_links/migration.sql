-- CreateEnum
CREATE TYPE "BankLinkType" AS ENUM ('TENANT', 'OWNER', 'CLIENT');

-- CreateTable
CREATE TABLE "bank_links" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "linkType" "BankLinkType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "plaidItemId" TEXT,
    "institutionName" TEXT,
    "accountId" TEXT,
    "accountMask" TEXT,
    "accountName" TEXT,
    "accountSubtype" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_links_clientId_idx" ON "bank_links"("clientId");

-- CreateIndex
CREATE INDEX "bank_links_linkType_entityId_idx" ON "bank_links"("linkType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_links_clientId_linkType_entityId_key" ON "bank_links"("clientId", "linkType", "entityId");

-- AddForeignKey
ALTER TABLE "bank_links" ADD CONSTRAINT "bank_links_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
