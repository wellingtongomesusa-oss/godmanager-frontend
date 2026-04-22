-- ============================================================
-- GodManager multi-tenant: views agregadas + Row-Level Security
-- Aplicado pela migration inicial. Idempotente onde possivel.
-- ============================================================

-- ---------- VIEW 1: owner_statement_monthly ----------
DROP VIEW IF EXISTS owner_statement_monthly CASCADE;

CREATE VIEW owner_statement_monthly AS
WITH monthly_gross AS (
  SELECT
    i.tenant_id,
    i.property_id,
    date_trunc('month', i.date)::date AS month,
    COALESCE(SUM(i.receipt_amount), 0) AS gross_income
  FROM income i
  GROUP BY i.tenant_id, i.property_id, date_trunc('month', i.date)
),
monthly_bills AS (
  SELECT
    b.tenant_id,
    b.owner_id,
    b.property_id,
    date_trunc('month', b.bill_date)::date AS month,
    COALESCE(SUM(CASE WHEN NOT b.is_owner_distribution
                      THEN b.amount_paid + b.amount_unpaid ELSE 0 END), 0) AS expenses,
    COALESCE(SUM(CASE WHEN b.is_owner_distribution
                      THEN b.amount_paid ELSE 0 END), 0) AS owner_distribution
  FROM bills b
  GROUP BY b.tenant_id, b.owner_id, b.property_id, date_trunc('month', b.bill_date)
)
SELECT
  COALESCE(mb.tenant_id, mg.tenant_id)        AS tenant_id,
  COALESCE(mb.owner_id, p.owner_id)           AS owner_id,
  COALESCE(mb.property_id, mg.property_id)    AS property_id,
  p.name                                      AS property_name,
  COALESCE(mb.month, mg.month)                AS month,
  COALESCE(mg.gross_income, 0)                AS gross_income,
  COALESCE(mb.expenses, 0)                    AS expenses,
  ROUND((p.mgmt_pct / 100.0) * COALESCE(mg.gross_income, 0), 2) AS mgmt_fee,
  COALESCE(mb.owner_distribution, 0)          AS owner_distribution,
  ROUND(
    COALESCE(mg.gross_income, 0)
    - COALESCE(mb.expenses, 0)
    - (p.mgmt_pct / 100.0) * COALESCE(mg.gross_income, 0)
  , 2)                                        AS net_owner
FROM monthly_bills mb
FULL OUTER JOIN monthly_gross mg
  ON mb.tenant_id = mg.tenant_id
 AND mb.property_id = mg.property_id
 AND mb.month = mg.month
JOIN properties p
  ON p.id = COALESCE(mb.property_id, mg.property_id)
 AND p.tenant_id = COALESCE(mb.tenant_id, mg.tenant_id);

-- ---------- VIEW 2: owner_1099_annual ----------
DROP VIEW IF EXISTS owner_1099_annual CASCADE;

CREATE VIEW owner_1099_annual AS
SELECT
  b.tenant_id,
  b.owner_id,
  o.full_name        AS owner_name,
  o.legal_name       AS owner_legal_name,
  o.tax_id,
  EXTRACT(YEAR FROM b.bill_date)::int AS year,
  ROUND(SUM(b.amount_paid), 2)         AS total_distributions
FROM bills b
JOIN owners o
  ON o.id = b.owner_id
 AND o.tenant_id = b.tenant_id
WHERE b.is_owner_distribution = TRUE
  AND o.send_1099 = TRUE
  AND b.amount_paid > 0
GROUP BY b.tenant_id, b.owner_id, o.full_name, o.legal_name, o.tax_id,
         EXTRACT(YEAR FROM b.bill_date)
HAVING SUM(b.amount_paid) >= 600;

-- ============================================================
-- ROW-LEVEL SECURITY: 11 tabelas de negocio
-- (excluido: tenants, users, tenant_users, audit_logs)
-- FORCE aplica policies tambem ao owner do schema.
-- A app deve fazer SET LOCAL app.current_tenant = '<uuid>'
-- antes de cada query (middleware Flask, proxima tarefa).
-- ============================================================

ALTER TABLE properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties        FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON properties;
CREATE POLICY tenant_isolation ON properties
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE owners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners            FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON owners;
CREATE POLICY tenant_isolation ON owners
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE leases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases            FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON leases;
CREATE POLICY tenant_isolation ON leases
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE tenant_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_records    FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_records;
CREATE POLICY tenant_isolation ON tenant_records
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE vendors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors           FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON vendors;
CREATE POLICY tenant_isolation ON vendors
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON expenses;
CREATE POLICY tenant_isolation ON expenses
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON bills;
CREATE POLICY tenant_isolation ON bills
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE income            ENABLE ROW LEVEL SECURITY;
ALTER TABLE income            FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON income;
CREATE POLICY tenant_isolation ON income
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE cleanings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanings         FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cleanings;
CREATE POLICY tenant_isolation ON cleanings
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE service_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests  FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON service_requests;
CREATE POLICY tenant_isolation ON service_requests
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
