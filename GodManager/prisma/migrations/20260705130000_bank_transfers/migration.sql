-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "bank_transfers" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "linkType" "BankLinkType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "bankLinkId" TEXT,
    "direction" "TransferDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plaidAuthorizationId" TEXT,
    "plaidTransferId" TEXT,
    "achClass" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_transfers_clientId_idx" ON "bank_transfers"("clientId");

-- CreateIndex
CREATE INDEX "bank_transfers_linkType_entityId_idx" ON "bank_transfers"("linkType", "entityId");

-- CreateIndex
CREATE INDEX "bank_transfers_status_idx" ON "bank_transfers"("status");

-- CreateIndex
CREATE INDEX "bank_transfers_plaidTransferId_idx" ON "bank_transfers"("plaidTransferId");

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
