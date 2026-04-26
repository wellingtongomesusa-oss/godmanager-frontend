-- CreateTable
CREATE TABLE "maintenance_calls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "isAlert" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_actions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'expense',
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_status_history" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedByEmail" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_calls_tenantId_idx" ON "maintenance_calls"("tenantId");

-- CreateIndex
CREATE INDEX "maintenance_calls_propertyId_idx" ON "maintenance_calls"("propertyId");

-- CreateIndex
CREATE INDEX "maintenance_calls_status_idx" ON "maintenance_calls"("status");

-- CreateIndex
CREATE INDEX "maintenance_calls_createdAt_idx" ON "maintenance_calls"("createdAt");

-- CreateIndex
CREATE INDEX "job_actions_jobId_idx" ON "job_actions"("jobId");

-- CreateIndex
CREATE INDEX "job_actions_action_idx" ON "job_actions"("action");

-- CreateIndex
CREATE INDEX "job_actions_createdAt_idx" ON "job_actions"("createdAt");

-- CreateIndex
CREATE INDEX "property_status_history_propertyId_idx" ON "property_status_history"("propertyId");

-- CreateIndex
CREATE INDEX "property_status_history_createdAt_idx" ON "property_status_history"("createdAt");

-- AddForeignKey
ALTER TABLE "maintenance_calls" ADD CONSTRAINT "maintenance_calls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_calls" ADD CONSTRAINT "maintenance_calls_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_status_history" ADD CONSTRAINT "property_status_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
