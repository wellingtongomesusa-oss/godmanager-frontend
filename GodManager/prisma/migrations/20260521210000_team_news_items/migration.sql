-- CreateTable
CREATE TABLE "team_news_items" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT,
    "jobId" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_news_items_clientId_createdAt_idx" ON "team_news_items"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "team_news_items_jobId_idx" ON "team_news_items"("jobId");

-- AddForeignKey
ALTER TABLE "team_news_items" ADD CONSTRAINT "team_news_items_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
