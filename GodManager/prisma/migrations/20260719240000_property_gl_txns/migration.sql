-- GL por casa no Statement individual (#41): recebido (4100) / enviado (3250). ADITIVO.
CREATE TABLE IF NOT EXISTS "property_gl_txns" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyKey" VARCHAR(200) NOT NULL,
    "propertyLabel" VARCHAR(200) NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "txnDate" DATE NOT NULL,
    "account" VARCHAR(10) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payerPayee" VARCHAR(200),
    "reference" VARCHAR(200),
    "description" VARCHAR(300),
    "tipo" VARCHAR(60),
    "sourceRefId" VARCHAR(140) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_gl_txns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "property_gl_txns_clientId_sourceRefId_key"
    ON "property_gl_txns"("clientId", "sourceRefId");
CREATE INDEX IF NOT EXISTS "property_gl_txns_clientId_propertyId_periodMonth_idx"
    ON "property_gl_txns"("clientId", "propertyId", "periodMonth");
CREATE INDEX IF NOT EXISTS "property_gl_txns_clientId_periodMonth_kind_idx"
    ON "property_gl_txns"("clientId", "periodMonth", "kind");

DO $$ BEGIN
    ALTER TABLE "property_gl_txns"
        ADD CONSTRAINT "property_gl_txns_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
