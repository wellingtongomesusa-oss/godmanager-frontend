-- Add per-client maxUsers override (null = use plan default)
ALTER TABLE "clients" ADD COLUMN "maxUsers" INTEGER;
