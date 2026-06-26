-- Billing sync: BILLING source + provisional line items
ALTER TYPE "LineItemSource" ADD VALUE IF NOT EXISTS 'BILLING';
ALTER TABLE "statement_line_items" ADD COLUMN IF NOT EXISTS "provisional" BOOLEAN NOT NULL DEFAULT false;
