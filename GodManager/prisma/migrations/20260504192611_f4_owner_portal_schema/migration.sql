-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'owner';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "owner_month_payouts" ADD COLUMN     "netPayout" DECIMAL(12,2),
ADD COLUMN     "previousBalance" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "totalExpenses" DECIMAL(12,2),
ADD COLUMN     "totalIncome" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_line_items" (
    "id" TEXT NOT NULL,
    "ownerMonthPayoutId" TEXT NOT NULL,
    "lineType" VARCHAR(20) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,

    CONSTRAINT "statement_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owners_clientId_idx" ON "owners"("clientId");

-- CreateIndex
CREATE INDEX "owners_email_idx" ON "owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "owners_clientId_email_key" ON "owners"("clientId", "email");

-- CreateIndex
CREATE INDEX "statement_line_items_ownerMonthPayoutId_idx" ON "statement_line_items"("ownerMonthPayoutId");

-- CreateIndex
CREATE INDEX "statement_line_items_clientId_idx" ON "statement_line_items"("clientId");

-- CreateIndex
CREATE INDEX "properties_ownerId_idx" ON "properties"("ownerId");

-- CreateIndex
CREATE INDEX "users_ownerId_idx" ON "users"("ownerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_line_items" ADD CONSTRAINT "statement_line_items_ownerMonthPayoutId_fkey" FOREIGN KEY ("ownerMonthPayoutId") REFERENCES "owner_month_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_line_items" ADD CONSTRAINT "statement_line_items_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
