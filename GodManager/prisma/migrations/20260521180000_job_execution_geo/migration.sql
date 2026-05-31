-- AlterTable: execução no terreno (GPS opcional) em pm_expenses (Job)
ALTER TABLE "pm_expenses" ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "executedLat" DOUBLE PRECISION,
ADD COLUMN     "executedLng" DOUBLE PRECISION,
ADD COLUMN     "executedAccuracy" DOUBLE PRECISION,
ADD COLUMN     "executedByUserId" TEXT;
