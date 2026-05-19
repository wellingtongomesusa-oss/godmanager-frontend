-- Run with psql outside a transaction block (never via prisma migrate if CONCURRENTLY is used).
-- Idempotent with IF NOT EXISTS: skips when index already exists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "properties_clientId_idx" ON "properties" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tenants_clientId_idx" ON "tenants" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "pm_expenses_clientId_idx" ON "pm_expenses" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "pm_vendors_clientId_idx" ON "pm_vendors" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "job_actions_clientId_idx" ON "job_actions" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "job_photos_clientId_idx" ON "job_photos" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "maintenance_calls_clientId_idx" ON "maintenance_calls" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "owner_month_payouts_clientId_idx" ON "owner_month_payouts" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "statement_line_items_clientId_idx" ON "statement_line_items" ("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "vendor_payments_clientId_idx" ON "vendor_payments" ("clientId");
