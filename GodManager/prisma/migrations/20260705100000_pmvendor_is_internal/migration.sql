-- Add isInternal flag to PmVendor: distingue equipe interna (ex.: Master Vacation) de vendors externos.
ALTER TABLE "pm_vendors" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- Marca a equipe interna existente como interna (Master Vacation Homes LLC).
UPDATE "pm_vendors" SET "isInternal" = true WHERE "companyName" ILIKE 'Master Vacation%';
