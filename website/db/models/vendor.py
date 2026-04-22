from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base, TimestampMixin


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 5)", name="ck_vendors_rating"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    gl_account: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    w9_on_file: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    bank_on_file: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    workers_comp_exp: Mapped[date | None] = mapped_column(Date, nullable=True)
    send_1099: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="active")
