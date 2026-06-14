-- billing module (AR/AP) — Fase A.1 fundacao
CREATE TABLE "billing_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'both',
    "isVendorRef" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_contacts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "billing_categories" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_categories_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "billing_descriptions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_descriptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "billing_documents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "docType" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "billingContactId" TEXT,
    "vendorId" TEXT,
    "propertyId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "billing_line_items" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "billing_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "billing_contacts_clientId_idx" ON "billing_contacts"("clientId");
CREATE INDEX "billing_categories_clientId_idx" ON "billing_categories"("clientId");
CREATE INDEX "billing_descriptions_clientId_idx" ON "billing_descriptions"("clientId");
CREATE INDEX "billing_documents_clientId_docType_status_idx" ON "billing_documents"("clientId","docType","status");
CREATE INDEX "billing_line_items_documentId_idx" ON "billing_line_items"("documentId");
ALTER TABLE "billing_line_items" ADD CONSTRAINT "billing_line_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "billing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
