-- Snapshot de gastos do Ramp por cliente (agregações), para consulta rápida no histórico.
CREATE TABLE "ramp_spend_snapshots" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "txCount" INTEGER NOT NULL DEFAULT 0,
  "totalSpend" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "periodFrom" TEXT,
  "periodTo" TEXT,
  "byMonth" JSONB,
  "byCategory" JSONB,
  "byMerchant" JSONB,
  "byCardholder" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ramp_spend_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ramp_spend_snapshots_clientId_key" ON "ramp_spend_snapshots"("clientId");

ALTER TABLE "ramp_spend_snapshots" ADD CONSTRAINT "ramp_spend_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
