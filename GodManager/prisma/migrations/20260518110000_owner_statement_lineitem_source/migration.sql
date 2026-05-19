-- CreateEnum
CREATE TYPE "LineItemSource" AS ENUM ('AUTO_RENTAL', 'AUTO_EXPENSE', 'MANUAL', 'CSV_UPLOAD');

-- AlterTable
ALTER TABLE "statement_line_items" ADD COLUMN "source" "LineItemSource" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "statement_line_items" ADD COLUMN "sourceRefId" TEXT;

ALTER TABLE "statement_line_items" ADD COLUMN "transactionDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "statement_line_items_clientId_lineType_source_idx" ON "statement_line_items"("clientId", "lineType", "source");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_line_item_source" ON "statement_line_items"("ownerMonthPayoutId", "source", "sourceRefId");
