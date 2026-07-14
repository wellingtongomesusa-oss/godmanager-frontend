-- Pedidos de liberação de acesso (ex.: FINANCE/QuickBooks) com aprovação por admin.
CREATE TABLE "access_requests" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "userName" TEXT,
  "resource" VARCHAR(40) NOT NULL,
  "message" VARCHAR(300),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedByEmail" TEXT,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_requests_clientId_status_idx" ON "access_requests"("clientId", "status");
CREATE INDEX "access_requests_userId_idx" ON "access_requests"("userId");

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
