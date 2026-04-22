from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base, CreatedAtMixin, TimestampMixin


class Lease(Base, TimestampMixin):
    __tablename__ = "leases"
    __table_args__ = (
        CheckConstraint(
            "status IN ('current','past','future','notice')",
            name="ck_leases_status",
        ),
        Index("ix_leases_tenant_status", "tenant_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rent: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    deposit: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    move_in_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    move_out_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notice_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class TenantRecord(Base, CreatedAtMixin):
    __tablename__ = "tenant_records"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lease_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("leases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ssn_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    driver_license: Mapped[str | None] = mapped_column(String(50), nullable=True)
    employer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    monthly_income: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    credit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
