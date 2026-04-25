-- CreateEnum
CREATE TYPE "PmPackage" AS ENUM ('PACOTE_1', 'PACOTE_2', 'PACOTE_3');

-- CreateEnum
CREATE TYPE "PmExpenseStatus" AS ENUM ('SCHEDULED', 'PAID', 'PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "pm_vendors" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressStreet" TEXT NOT NULL,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "trade" TEXT,
    "serviceType" TEXT,
    "defaultPackage" "PmPackage" NOT NULL DEFAULT 'PACOTE_1',
    "bankName" TEXT,
    "routingNumber" TEXT,
    "accountNumber" TEXT,
    "accountType" TEXT,
    "paymentType" TEXT,
    "commissionMp" BOOLEAN NOT NULL DEFAULT false,
    "send1099" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pm_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_expenses" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "vendorId" TEXT,
    "serviceType" TEXT,
    "packageApplied" "PmPackage" NOT NULL,
    "vendorCost" DECIMAL(12,2) NOT NULL,
    "ownerCharged" DECIMAL(12,2) NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "monthRef" TEXT NOT NULL,
    "status" "PmExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pm_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_month_payouts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_month_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pm_vendors_companyName_idx" ON "pm_vendors"("companyName");

-- CreateIndex
CREATE INDEX "pm_expenses_propertyId_monthRef_idx" ON "pm_expenses"("propertyId", "monthRef");

-- CreateIndex
CREATE INDEX "pm_expenses_monthRef_idx" ON "pm_expenses"("monthRef");

-- CreateIndex
CREATE INDEX "pm_expenses_vendorId_idx" ON "pm_expenses"("vendorId");

-- CreateIndex
CREATE INDEX "owner_month_payouts_yearMonth_idx" ON "owner_month_payouts"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "owner_month_payouts_propertyId_yearMonth_key" ON "owner_month_payouts"("propertyId", "yearMonth");

-- AddForeignKey
ALTER TABLE "pm_expenses" ADD CONSTRAINT "pm_expenses_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_expenses" ADD CONSTRAINT "pm_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "pm_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_month_payouts" ADD CONSTRAINT "owner_month_payouts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
