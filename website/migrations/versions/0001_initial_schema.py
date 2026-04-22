"""initial schema (multi-tenant): 15 tables + 2 views + 11 RLS

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-21
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VIEWS_SQL_PATH = Path(__file__).resolve().parents[2] / "db" / "views.sql"

RLS_TABLES = [
    "properties", "owners", "leases", "tenant_records", "vendors",
    "expenses", "bills", "income", "cleanings", "service_requests", "documents",
    "audit_logs",
]


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("plan", sa.String(30), nullable=False, server_default="trial"),
        sa.Column("stripe_customer_id", sa.String(100)),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clerk_id", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("full_name", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "tenant_users",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("role IN ('owner','admin','manager','viewer')", name="ck_tenant_users_role"),
    )

    op.create_table(
        "owners",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("legal_name", sa.String(200)),
        sa.Column("email", sa.String(200)),
        sa.Column("phone", sa.String(30)),
        sa.Column("address", sa.String(300)),
        sa.Column("tax_id", sa.Text),
        sa.Column("payment_type", sa.String(20)),
        sa.Column("bank_routing", sa.Text),
        sa.Column("bank_account", sa.Text),
        sa.Column("send_1099", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_owners_tenant_id", "owners", ["tenant_id"])

    op.create_table(
        "vendors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("contact_name", sa.String(200)),
        sa.Column("trade", sa.String(100)),
        sa.Column("email", sa.String(200)),
        sa.Column("phone", sa.String(30)),
        sa.Column("address", sa.String(300)),
        sa.Column("gl_account", sa.String(50)),
        sa.Column("payment_type", sa.String(20)),
        sa.Column("w9_on_file", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("bank_on_file", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("workers_comp_exp", sa.Date),
        sa.Column("send_1099", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("rating", sa.Integer),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 5)", name="ck_vendors_rating"),
    )
    op.create_index("ix_vendors_tenant_id", "vendors", ["tenant_id"])

    op.create_table(
        "properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("owners.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.String(2)),
        sa.Column("zip", sa.String(10)),
        sa.Column("county", sa.String(50)),
        sa.Column("units", sa.Integer, nullable=False, server_default="1"),
        sa.Column("sqft", sa.Integer),
        sa.Column("market_rent", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("current_rent", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("mgmt_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("mgmt_flat_fee", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("min_fee", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("reserve", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_properties_tenant_id", "properties", ["tenant_id"])
    op.create_index("ix_properties_tenant_status", "properties", ["tenant_id", "status"])

    op.create_table(
        "leases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("rent", sa.Numeric(10, 2)),
        sa.Column("deposit", sa.Numeric(10, 2)),
        sa.Column("move_in_date", sa.Date),
        sa.Column("move_out_date", sa.Date),
        sa.Column("notice_date", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('current','past','future','notice')", name="ck_leases_status"),
    )
    op.create_index("ix_leases_tenant_id", "leases", ["tenant_id"])
    op.create_index("ix_leases_property_id", "leases", ["property_id"])
    op.create_index("ix_leases_tenant_status", "leases", ["tenant_id", "status"])

    op.create_table(
        "tenant_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lease_id", UUID(as_uuid=True), sa.ForeignKey("leases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200)),
        sa.Column("phone", sa.String(30)),
        sa.Column("ssn_last4", sa.String(4)),
        sa.Column("driver_license", sa.String(50)),
        sa.Column("employer", sa.String(200)),
        sa.Column("monthly_income", sa.Numeric(10, 2)),
        sa.Column("credit_score", sa.Integer),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_tenant_records_tenant_id", "tenant_records", ["tenant_id"])
    op.create_index("ix_tenant_records_lease_id", "tenant_records", ["lease_id"])

    op.create_table(
        "expenses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL")),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL")),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("category", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("invoice_url", sa.Text),
        sa.Column("approval_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "approval_status IN ('pending','invoice_received','in_appfolio','approved')",
            name="ck_expenses_approval_status",
        ),
    )
    op.create_index("ix_expenses_tenant_id", "expenses", ["tenant_id"])
    op.create_index("ix_expenses_tenant_property", "expenses", ["tenant_id", "property_id"])

    op.create_table(
        "bills",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("owners.id", ondelete="SET NULL")),
        sa.Column("bill_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date),
        sa.Column("gl_account", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("amount_unpaid", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("paid_date", sa.Date),
        sa.Column("is_owner_distribution", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_bills_tenant_id", "bills", ["tenant_id"])
    op.create_index("ix_bills_tenant_property", "bills", ["tenant_id", "property_id"])
    op.create_index("ix_bills_tenant_owner", "bills", ["tenant_id", "owner_id"])

    op.create_table(
        "income",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lease_id", UUID(as_uuid=True), sa.ForeignKey("leases.id", ondelete="SET NULL")),
        sa.Column("payer_name", sa.String(200)),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("account", sa.String(50)),
        sa.Column("receipt_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("charge_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_income_tenant_id", "income", ["tenant_id"])
    op.create_index("ix_income_tenant_property", "income", ["tenant_id", "property_id"])

    op.create_table(
        "cleanings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL")),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("type", sa.String(50)),
        sa.Column("amount", sa.Numeric(10, 2)),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_cleanings_tenant_id", "cleanings", ["tenant_id"])

    op.create_table(
        "service_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lease_id", UUID(as_uuid=True), sa.ForeignKey("leases.id", ondelete="SET NULL")),
        sa.Column("ref_number", sa.String(30), nullable=False),
        sa.Column("type", sa.String(50)),
        sa.Column("priority", sa.String(20)),
        sa.Column("status", sa.String(30)),
        sa.Column("title", sa.String(200)),
        sa.Column("description", sa.Text),
        sa.Column("attachments", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "ref_number", name="uq_service_requests_tenant_ref"),
    )
    op.create_index("ix_service_requests_tenant_id", "service_requests", ["tenant_id"])

    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(50)),
        sa.Column("filename", sa.String(300)),
        sa.Column("storage_url", sa.Text),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_documents_tenant_id", "documents", ["tenant_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(30)),
        sa.Column("entity_id", UUID(as_uuid=True)),
        sa.Column("before", JSONB),
        sa.Column("after", JSONB),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])

    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    if VIEWS_SQL_PATH.exists():
        sql = VIEWS_SQL_PATH.read_text(encoding="utf-8")
        op.execute(sa.text(sql))


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS owner_1099_annual CASCADE;")
    op.execute("DROP VIEW IF EXISTS owner_statement_monthly CASCADE;")
    for tbl in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

    op.drop_table("audit_logs")
    op.drop_table("documents")
    op.drop_table("service_requests")
    op.drop_table("cleanings")
    op.drop_table("income")
    op.drop_table("bills")
    op.drop_table("expenses")
    op.drop_table("tenant_records")
    op.drop_table("leases")
    op.drop_table("properties")
    op.drop_table("vendors")
    op.drop_table("owners")
    op.drop_table("tenant_users")
    op.drop_table("users")
    op.drop_table("tenants")
