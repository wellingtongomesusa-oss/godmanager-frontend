"""Persistence models for shared dashboard data."""
from __future__ import annotations

from app import db


class Property(db.Model):
    __tablename__ = "gm_properties"

    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(500))
    city = db.Column(db.String(100))
    state = db.Column(db.String(10))
    zip_code = db.Column(db.String(20))
    market_rent = db.Column(db.Float, default=0)
    sqft = db.Column(db.Integer, default=0)
    units = db.Column(db.Integer, default=1)
    mgmt_fee_percent = db.Column(db.Float, default=0)
    mgmt_flat_fee = db.Column(db.Float, default=0)
    min_fee = db.Column(db.Float, default=0)
    max_fee = db.Column(db.Float, default=0)
    waive_when_vacant = db.Column(db.String(10), default="No")
    reserve = db.Column(db.Float, default=0)
    home_warranty_exp = db.Column(db.String(50))
    insurance_exp = db.Column(db.String(50))
    tax_year_end = db.Column(db.String(10))
    owner_name = db.Column(db.String(200))
    owner_phone = db.Column(db.String(100))
    description = db.Column(db.Text)
    source = db.Column(db.String(50), default="appfolio")
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())


class Expense(db.Model):
    __tablename__ = "gm_expenses"

    id = db.Column(db.Integer, primary_key=True)
    property_address = db.Column(db.String(500))
    unit = db.Column(db.String(50))
    payee_name = db.Column(db.String(200))
    bill_date = db.Column(db.String(20))
    check_date = db.Column(db.String(20))
    expense_account = db.Column(db.String(200))
    cash_account = db.Column(db.String(200))
    amount = db.Column(db.Float, default=0)
    paid_status = db.Column(db.String(50))
    reference = db.Column(db.String(100))
    description = db.Column(db.Text)
    source = db.Column(db.String(50), default="appfolio")
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())


class SiteConfig(db.Model):
    __tablename__ = "gm_site_config"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())


class AppData(db.Model):
    """Key-value JSON blobs (full AppFolio shapes, vendors, etc.) for cross-device sync."""

    __tablename__ = "app_data"

    id = db.Column(db.Integer, primary_key=True)
    data_key = db.Column(db.String(100), unique=True, nullable=False)
    data_value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

