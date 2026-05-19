-- AlterTable
ALTER TABLE "owner_month_payouts" ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "closedBy" TEXT,
ADD COLUMN "lastSentAt" TIMESTAMP(3);
