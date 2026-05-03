-- AlterTable
ALTER TABLE "owner_month_payouts" ADD COLUMN     "method" VARCHAR(40),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAmount" DECIMAL(12,2),
ADD COLUMN     "paidByEmail" TEXT,
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "reference" VARCHAR(120);
