-- AlterEnum
ALTER TYPE "PmExpenseStatus" ADD VALUE 'FINALIZED';

-- AlterTable
ALTER TABLE "pm_expenses" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "finalizedNote" TEXT;
