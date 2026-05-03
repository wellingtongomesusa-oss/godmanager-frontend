-- AlterTable
ALTER TABLE "audit_entries" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "job_actions" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "maintenance_calls" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "owner_month_payouts" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "pm_expenses" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "pm_vendors" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "property_status_history" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "vendor_payments" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "audit_entries_clientId_idx" ON "audit_entries"("clientId");

-- CreateIndex
CREATE INDEX "job_actions_clientId_idx" ON "job_actions"("clientId");

-- CreateIndex
CREATE INDEX "maintenance_calls_clientId_idx" ON "maintenance_calls"("clientId");

-- CreateIndex
CREATE INDEX "owner_month_payouts_clientId_idx" ON "owner_month_payouts"("clientId");

-- CreateIndex
CREATE INDEX "pm_expenses_clientId_idx" ON "pm_expenses"("clientId");

-- CreateIndex
CREATE INDEX "pm_vendors_clientId_idx" ON "pm_vendors"("clientId");

-- CreateIndex
CREATE INDEX "properties_clientId_idx" ON "properties"("clientId");

-- CreateIndex
CREATE INDEX "property_status_history_clientId_idx" ON "property_status_history"("clientId");

-- CreateIndex
CREATE INDEX "subscriptions_clientId_idx" ON "subscriptions"("clientId");

-- CreateIndex
CREATE INDEX "tenants_clientId_idx" ON "tenants"("clientId");

-- CreateIndex
CREATE INDEX "vendor_payments_clientId_idx" ON "vendor_payments"("clientId");

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_calls" ADD CONSTRAINT "maintenance_calls_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_actions" ADD CONSTRAINT "job_actions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_status_history" ADD CONSTRAINT "property_status_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_vendors" ADD CONSTRAINT "pm_vendors_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_expenses" ADD CONSTRAINT "pm_expenses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_month_payouts" ADD CONSTRAINT "owner_month_payouts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
