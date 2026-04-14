"""Data persistence API routes (Postgres-backed)."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request

from app import db
from models import Expense, Property, SiteConfig

data_bp = Blueprint("data", __name__, url_prefix="/api/data")


def _f(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return float(default)
        return float(v)
    except (TypeError, ValueError):
        return float(default)


def _i(v: Any, default: int = 0) -> int:
    try:
        if v is None or v == "":
            return int(default)
        return int(float(v))
    except (TypeError, ValueError):
        return int(default)


def _s(v: Any) -> str:
    return "" if v is None else str(v).strip()


def _serialize_property(p: Property) -> Dict[str, Any]:
    return {
        "id": p.id,
        "address": p.address or "",
        "city": p.city or "",
        "state": p.state or "",
        "zip": p.zip_code or "",
        "marketRent": p.market_rent or 0,
        "sqft": p.sqft or 0,
        "units": p.units or 1,
        "mgmtPercent": p.mgmt_fee_percent or 0,
        "managementFlatFee": p.mgmt_flat_fee or 0,
        "minimumFee": p.min_fee or 0,
        "maximumFee": p.max_fee or 0,
        "waiveFeesWhenVacant": p.waive_when_vacant or "No",
        "reserve": p.reserve or 0,
        "homeWarrantyExpiration": p.home_warranty_exp or "",
        "insuranceExpiration": p.insurance_exp or "",
        "taxYearEnd": p.tax_year_end or "",
        "ownerName": p.owner_name or "",
        "ownerPhone": p.owner_phone or "",
        "description": p.description or "",
        "source": p.source or "appfolio",
    }


def _serialize_expense(e: Expense) -> Dict[str, Any]:
    return {
        "id": e.id,
        "property": e.property_address or "",
        "unit": e.unit or "",
        "payee": e.payee_name or "",
        "billDate": e.bill_date or "",
        "checkDate": e.check_date or "",
        "expenseAccount": e.expense_account or "",
        "cashAccount": e.cash_account or "",
        "amount": e.amount or 0,
        "paymentStatus": e.paid_status or "",
        "reference": e.reference or "",
        "description": e.description or "",
        "source": e.source or "appfolio",
    }


def _upsert_property(row: Dict[str, Any]) -> Property:
    address = _s(row.get("address") or row.get("property"))
    owner_name = _s(row.get("ownerName") or row.get("owner"))
    source = _s(row.get("source") or "appfolio")
    found = (
        Property.query.filter_by(address=address, owner_name=owner_name, source=source)
        .order_by(Property.id.desc())
        .first()
    )
    p = found or Property()
    p.address = address
    p.city = _s(row.get("city"))
    p.state = _s(row.get("state"))
    p.zip_code = _s(row.get("zip") or row.get("zip_code"))
    p.market_rent = _f(row.get("marketRent") or row.get("market_rent"))
    p.sqft = _i(row.get("sqft"))
    p.units = _i(row.get("units"), 1)
    p.mgmt_fee_percent = _f(row.get("mgmtPercent") or row.get("mgmt_fee_percent"))
    p.mgmt_flat_fee = _f(row.get("managementFlatFee") or row.get("mgmt_flat_fee"))
    p.min_fee = _f(row.get("minimumFee") or row.get("min_fee"))
    p.max_fee = _f(row.get("maximumFee") or row.get("max_fee"))
    p.waive_when_vacant = _s(row.get("waiveFeesWhenVacant") or row.get("waive_when_vacant") or "No")
    p.reserve = _f(row.get("reserve"))
    p.home_warranty_exp = _s(row.get("homeWarrantyExpiration") or row.get("home_warranty_exp"))
    p.insurance_exp = _s(row.get("insuranceExpiration") or row.get("insurance_exp"))
    p.tax_year_end = _s(row.get("taxYearEnd") or row.get("tax_year_end"))
    p.owner_name = owner_name
    p.owner_phone = _s(row.get("ownerPhone") or row.get("owner_phone"))
    p.description = _s(row.get("description"))
    p.source = source
    if not found:
        db.session.add(p)
    return p


def _upsert_expense(row: Dict[str, Any]) -> Expense:
    prop = _s(row.get("property") or row.get("property_address"))
    payee = _s(row.get("payee") or row.get("payee_name"))
    bill = _s(row.get("billDate") or row.get("bill_date"))
    amount = _f(row.get("amount"))
    source = _s(row.get("source") or "appfolio")
    found = (
        Expense.query.filter_by(property_address=prop, payee_name=payee, bill_date=bill, amount=amount, source=source)
        .order_by(Expense.id.desc())
        .first()
    )
    e = found or Expense()
    e.property_address = prop
    e.unit = _s(row.get("unit"))
    e.payee_name = payee
    e.bill_date = bill
    e.check_date = _s(row.get("checkDate") or row.get("check_date"))
    e.expense_account = _s(row.get("expenseAccount") or row.get("expense_account"))
    e.cash_account = _s(row.get("cashAccount") or row.get("cash_account"))
    e.amount = amount
    e.paid_status = _s(row.get("paymentStatus") or row.get("paid_status"))
    e.reference = _s(row.get("reference"))
    e.description = _s(row.get("description"))
    e.source = source
    if not found:
        db.session.add(e)
    return e


@data_bp.post("/properties/import")
def import_properties():
    rows = request.get_json(silent=True) or []
    rows = rows if isinstance(rows, list) else []
    for row in rows:
        if isinstance(row, dict):
            _upsert_property(row)
    db.session.commit()
    return jsonify({"ok": True, "count": len(rows)})


@data_bp.get("/properties")
def get_properties():
    props = Property.query.order_by(Property.updated_at.desc(), Property.id.desc()).all()
    return jsonify({"properties": [_serialize_property(p) for p in props]})


@data_bp.put("/properties/<int:pid>")
def update_property(pid: int):
    p = Property.query.get(pid)
    if not p:
        return jsonify({"error": "Property not found"}), 404
    row = request.get_json(silent=True) or {}
    row["source"] = row.get("source") or p.source
    p = _upsert_property({**_serialize_property(p), **row})
    db.session.commit()
    return jsonify({"ok": True, "property": _serialize_property(p)})


@data_bp.delete("/properties/<int:pid>")
def delete_property(pid: int):
    p = Property.query.get(pid)
    if not p:
        return jsonify({"error": "Property not found"}), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify({"ok": True})


@data_bp.post("/expenses/import")
def import_expenses():
    rows = request.get_json(silent=True) or []
    rows = rows if isinstance(rows, list) else []
    for row in rows:
        if isinstance(row, dict):
            _upsert_expense(row)
    db.session.commit()
    return jsonify({"ok": True, "count": len(rows)})


@data_bp.get("/expenses")
def get_expenses():
    exps = Expense.query.order_by(Expense.updated_at.desc(), Expense.id.desc()).all()
    return jsonify({"expenses": [_serialize_expense(e) for e in exps]})


@data_bp.put("/expenses/<int:eid>")
def update_expense(eid: int):
    e = Expense.query.get(eid)
    if not e:
        return jsonify({"error": "Expense not found"}), 404
    row = request.get_json(silent=True) or {}
    row["source"] = row.get("source") or e.source
    e = _upsert_expense({**_serialize_expense(e), **row})
    db.session.commit()
    return jsonify({"ok": True, "expense": _serialize_expense(e)})


@data_bp.delete("/expenses/<int:eid>")
def delete_expense(eid: int):
    e = Expense.query.get(eid)
    if not e:
        return jsonify({"error": "Expense not found"}), 404
    db.session.delete(e)
    db.session.commit()
    return jsonify({"ok": True})


@data_bp.post("/config/save")
def save_config():
    payload = request.get_json(silent=True) or {}
    key = _s(payload.get("key"))
    value = payload.get("value")
    if not key:
        return jsonify({"error": "key required"}), 400
    cfg = SiteConfig.query.filter_by(key=key).first() or SiteConfig(key=key)
    cfg.value = json.dumps(value) if not isinstance(value, str) else value
    db.session.add(cfg)
    db.session.commit()
    return jsonify({"ok": True})


@data_bp.get("/config/load")
def load_config():
    rows = SiteConfig.query.order_by(SiteConfig.key.asc()).all()
    out = {}
    for r in rows:
        try:
            out[r.key] = json.loads(r.value or "")
        except Exception:
            out[r.key] = r.value
    return jsonify({"config": out})


@data_bp.post("/save-all")
def save_all():
    payload = request.get_json(silent=True) or {}
    properties = payload.get("properties") or []
    expenses = payload.get("expenses") or []
    config = payload.get("config") or {}

    for row in properties:
        if isinstance(row, dict):
            _upsert_property(row)
    for row in expenses:
        if isinstance(row, dict):
            _upsert_expense(row)
    if isinstance(config, dict):
        for k, v in config.items():
            key = _s(k)
            if not key:
                continue
            cfg = SiteConfig.query.filter_by(key=key).first() or SiteConfig(key=key)
            cfg.value = json.dumps(v) if not isinstance(v, str) else v
            db.session.add(cfg)
    db.session.commit()
    return jsonify({"ok": True, "saved": {"properties": len(properties), "expenses": len(expenses), "config": len(config) if isinstance(config, dict) else 0}})


@data_bp.get("/load-all")
def load_all():
    props = Property.query.order_by(Property.updated_at.desc(), Property.id.desc()).all()
    exps = Expense.query.order_by(Expense.updated_at.desc(), Expense.id.desc()).all()
    cfg_rows = SiteConfig.query.order_by(SiteConfig.key.asc()).all()
    cfg = {}
    for r in cfg_rows:
        try:
            cfg[r.key] = json.loads(r.value or "")
        except Exception:
            cfg[r.key] = r.value
    return jsonify({"properties": [_serialize_property(p) for p in props], "expenses": [_serialize_expense(e) for e in exps], "config": cfg})

