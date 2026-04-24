-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "unitType" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "rent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "mgmtFeePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_code_key" ON "properties"("code");

-- CreateIndex
CREATE INDEX "properties_code_idx" ON "properties"("code");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");
