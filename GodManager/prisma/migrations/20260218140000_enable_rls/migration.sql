-- RLS tenant isolation (defesa em profundidade).
-- Políticas permitem linhas quando:
--   (a) app.current_client_id = 'SUPER_ADMIN_BYPASS', OU
--   (b) row."clientId" = current_app_client_id(), OU
--   (c) app.current_client_id não definido (NULL) — migrações / scripts / pool sem SET LOCAL.
--
-- NOTA: Superutilizadores PostgreSQL ignoram RLS. Se DATABASE_URL usar role `postgres`,
-- os smokes com Prisma não demonstram isolamento até usar um utilizador não superuser.

CREATE OR REPLACE FUNCTION current_app_client_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_client_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin_bypass() RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_client_id', true), '') = 'SUPER_ADMIN_BYPASS';
END;
$$ LANGUAGE plpgsql STABLE;

-- analytics_snapshots
ALTER TABLE "analytics_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "analytics_snapshots" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "analytics_snapshots" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "analytics_snapshots" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "analytics_snapshots" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- audit_entries
ALTER TABLE "audit_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "audit_entries" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "audit_entries" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "audit_entries" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "audit_entries" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- client_integrations
ALTER TABLE "client_integrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "client_integrations" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "client_integrations" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "client_integrations" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "client_integrations" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- comments
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "comments" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "comments" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "comments" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "comments" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- csv_batches
ALTER TABLE "csv_batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "csv_batches" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "csv_batches" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "csv_batches" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "csv_batches" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- gl_entries
ALTER TABLE "gl_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "gl_entries" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "gl_entries" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "gl_entries" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "gl_entries" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- gl_imports
ALTER TABLE "gl_imports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "gl_imports" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "gl_imports" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "gl_imports" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "gl_imports" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- job_actions
ALTER TABLE "job_actions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "job_actions" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "job_actions" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "job_actions" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "job_actions" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- job_photos
ALTER TABLE "job_photos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "job_photos" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "job_photos" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "job_photos" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "job_photos" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- lease_imports
ALTER TABLE "lease_imports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "lease_imports" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "lease_imports" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "lease_imports" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "lease_imports" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- leases
ALTER TABLE "leases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "leases" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "leases" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "leases" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "leases" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- maintenance_calls
ALTER TABLE "maintenance_calls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "maintenance_calls" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "maintenance_calls" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "maintenance_calls" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "maintenance_calls" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- owner_month_payouts
ALTER TABLE "owner_month_payouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "owner_month_payouts" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "owner_month_payouts" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "owner_month_payouts" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "owner_month_payouts" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- owners
ALTER TABLE "owners" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "owners" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "owners" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "owners" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "owners" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- pm_expenses
ALTER TABLE "pm_expenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "pm_expenses" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "pm_expenses" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "pm_expenses" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "pm_expenses" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- pm_vendors
ALTER TABLE "pm_vendors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "pm_vendors" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "pm_vendors" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "pm_vendors" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "pm_vendors" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- properties
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "properties" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "properties" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "properties" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "properties" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- property_status_history
ALTER TABLE "property_status_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "property_status_history" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "property_status_history" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "property_status_history" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "property_status_history" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- statement_line_items
ALTER TABLE "statement_line_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "statement_line_items" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "statement_line_items" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "statement_line_items" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "statement_line_items" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- subscriptions
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "subscriptions" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "subscriptions" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "subscriptions" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "subscriptions" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- tenant_payments
ALTER TABLE "tenant_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "tenant_payments" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "tenant_payments" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "tenant_payments" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "tenant_payments" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- tenants
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "tenants" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "tenants" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "tenants" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "tenants" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- user_permissions
ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "user_permissions" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "user_permissions" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "user_permissions" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "user_permissions" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "users" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "users" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "users" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "users" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);

-- vendor_payments
ALTER TABLE "vendor_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "vendor_payments" FOR SELECT USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_insert ON "vendor_payments" FOR INSERT WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_update ON "vendor_payments" FOR UPDATE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
) WITH CHECK (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
CREATE POLICY tenant_isolation_delete ON "vendor_payments" FOR DELETE USING (
  is_super_admin_bypass() OR current_app_client_id() IS NULL OR "clientId" = current_app_client_id()
);
