-- CreateTable
CREATE TABLE "sophia_snapshots" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kpis" JSONB NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sophia_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sophia_snapshots_clientId_key" ON "sophia_snapshots"("clientId");

-- AddForeignKey
ALTER TABLE "sophia_snapshots" ADD CONSTRAINT "sophia_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
