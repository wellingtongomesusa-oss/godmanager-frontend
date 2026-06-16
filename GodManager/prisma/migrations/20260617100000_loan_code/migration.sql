ALTER TABLE "loans" ADD COLUMN "code" TEXT;

WITH numbered AS (
  SELECT id, 'LOAN-' || LPAD((ROW_NUMBER() OVER (PARTITION BY "clientId" ORDER BY "createdAt"))::text, 4, '0') AS new_code
  FROM "loans"
)
UPDATE "loans" l SET "code" = n.new_code FROM numbered n WHERE l.id = n.id;
