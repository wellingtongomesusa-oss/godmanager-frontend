-- DropForeignKey
ALTER TABLE "audit_entries" DROP CONSTRAINT "audit_entries_actorId_fkey";

-- AlterTable
ALTER TABLE "audit_entries" ADD COLUMN     "actorEmail" TEXT,
ADD COLUMN     "entity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "actorId" DROP NOT NULL,
ALTER COLUMN "details" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "audit_entries_entity_idx" ON "audit_entries"("entity");

-- CreateIndex
CREATE INDEX "audit_entries_action_idx" ON "audit_entries"("action");

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
