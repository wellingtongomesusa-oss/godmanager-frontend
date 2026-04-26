-- CreateTable
CREATE TABLE "demo_leads" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "redeSocial" TEXT,
    "siteEmpresa" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_leads_email_idx" ON "demo_leads"("email");

-- CreateIndex
CREATE INDEX "demo_leads_createdAt_idx" ON "demo_leads"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "demo_tokens_token_key" ON "demo_tokens"("token");

-- CreateIndex
CREATE INDEX "demo_tokens_token_idx" ON "demo_tokens"("token");

-- CreateIndex
CREATE INDEX "demo_tokens_expiresAt_idx" ON "demo_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "demo_tokens" ADD CONSTRAINT "demo_tokens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "demo_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
