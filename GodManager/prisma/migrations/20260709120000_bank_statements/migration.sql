-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "statementDate" DATE NOT NULL,
    "bankName" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statements_clientId_periodMonth_idx" ON "bank_statements"("clientId", "periodMonth");

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
