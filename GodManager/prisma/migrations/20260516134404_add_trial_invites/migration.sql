CREATE TABLE "trial_invites" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdBy" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedByEmail" TEXT,
  "usedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trial_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trial_invites_token_key" ON "trial_invites"("token");
CREATE INDEX "trial_invites_expiresAt_idx" ON "trial_invites"("expiresAt");
