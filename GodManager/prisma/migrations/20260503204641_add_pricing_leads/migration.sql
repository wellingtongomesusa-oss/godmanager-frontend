-- CreateTable
CREATE TABLE "pricing_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "segment" "BusinessSegment",
    "packageTier" INTEGER,
    "avgRent" DECIMAL(12,2),
    "avgVgv" DECIMAL(14,2),
    "unitCount" INTEGER,
    "properties" INTEGER,
    "systems" TEXT[],
    "pricePerUnit" DECIMAL(10,4),
    "monthlyTotal" DECIMAL(12,2),
    "annualTotal" DECIMAL(14,2),
    "source" TEXT NOT NULL DEFAULT 'savings_wizard',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "convertedToSubscription" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_leads_email_idx" ON "pricing_leads"("email");

-- CreateIndex
CREATE INDEX "pricing_leads_createdAt_idx" ON "pricing_leads"("createdAt");
