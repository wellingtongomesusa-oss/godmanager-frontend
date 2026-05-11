-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('RAMP', 'QUICKBOOKS', 'PLAID', 'APPFOLIO');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED');

-- CreateTable
CREATE TABLE "client_integrations" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "externalAccountId" TEXT,
    "scope" TEXT,
    "metadata" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedByUserId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_integrations_clientId_idx" ON "client_integrations"("clientId");

-- CreateIndex
CREATE INDEX "client_integrations_provider_status_idx" ON "client_integrations"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "client_integrations_clientId_provider_key" ON "client_integrations"("clientId", "provider");

-- AddForeignKey
ALTER TABLE "client_integrations" ADD CONSTRAINT "client_integrations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
