CREATE TABLE IF NOT EXISTS "qbo_reconcile_maps" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "mapping" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qbo_reconcile_maps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "qbo_reconcile_maps_clientId_key" ON "qbo_reconcile_maps"("clientId");
