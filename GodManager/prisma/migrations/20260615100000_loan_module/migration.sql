CREATE TABLE "loans" (
  "id" TEXT PRIMARY KEY,
  "clientId" TEXT,
  "propertyId" TEXT,
  "debtorName" TEXT NOT NULL,
  "guarantorName" TEXT,
  "principal" DECIMAL(12,2) NOT NULL,
  "interestRate" DECIMAL(5,2),
  "startDate" TIMESTAMP(3) NOT NULL,
  "installmentsCount" INTEGER,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "loans_clientId_idx" ON "loans"("clientId");
CREATE INDEX "loans_propertyId_idx" ON "loans"("propertyId");
CREATE TABLE "loan_installments" (
  "id" TEXT PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "clientId" TEXT,
  "seq" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paidAt" TIMESTAMP(3),
  "paidAmount" DECIMAL(12,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_installments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE
);
CREATE INDEX "loan_installments_loanId_idx" ON "loan_installments"("loanId");
CREATE INDEX "loan_installments_clientId_idx" ON "loan_installments"("clientId");
