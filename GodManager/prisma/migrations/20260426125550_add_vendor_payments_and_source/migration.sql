-- AlterTable
ALTER TABLE "pm_vendors" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidBy" TEXT,
    "metadata" JSONB,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_payments_vendorId_idx" ON "vendor_payments"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_payments_paidAt_idx" ON "vendor_payments"("paidAt");

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "pm_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
