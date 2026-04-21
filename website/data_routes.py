"""Data persistence API routes (Postgres-backed)."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from flask import Blueprint, jsonify, request
from app import db
from models import AppData, ClientAccount, ClientUser, Expense, Property, SiteConfig

_APPDATA_EXTRA_KEYS = frozenset(
    {
        "appfolio_vendors",
        "manual_properties",
        "manual_expenses",
        "site_config",
        "gm_vendors",
        "owner_payments",
        "owner_payment_logs",
        "owner_payment_history",
        "ramp_expenses",
        "expense_owner_payment_log",
        "expense_register",
    }
)

_CATEGORY_TO_ACCOUNT = {
    "Management Fee": "6111",
    "Lease Fee": "6112",
    "Late Fee": "4460",
    "HOA": "6075",
    "Cleaning": "6076",
    "Maintenance": "6073",
    "HVAC": "6144",
    "Plumbing": "6142",
    "Painting": "6141",
    "Landscaping": "6074",
    "Appliances": "7010",
    "Insurance": "6103",
    "Utilities": "6103",
    "Payroll": "6103",
    "Other": "6103",
}

_MVH_SYNONYMS = {
    "master vacation homes",
    "master vacation homes llc",
    "mvh",
    "master vacation",
}

# Single JSON object: mirrors former browser localStorage (cross-device).
_CLIENT_KV_ROW_KEY = "gm_client_kv"


def _load_client_kv() -> Dict[str, Any]:
    row = _appdata_row(_CLIENT_KV_ROW_KEY)
    if not row:
        return {}
    try:
        v = json.loads(row.data_value or "{}")
    except Exception:
        return {}
    return v if isinstance(v, dict) else {}


def _persist_client_kv(data: Dict[str, Any]) -> None:
    _persist_appdata(_CLIENT_KV_ROW_KEY, data)


def _merge_client_kv(updates: Optional[dict]) -> None:
    if not isinstance(updates, dict):
        return
    base = _load_client_kv()
    for k, v in updates.items():
        ks = str(k) if k is not None else ""
        if not ks or len(ks) > 200:
            continue
        if v is None:
            base.pop(ks, None)
        else:
            base[ks] = v
    _persist_client_kv(base)


def _appdata_key_ok(key: str) -> bool:
    if not key or len(key) > 100:
        return False
    if not (key[0].isalpha() or key[0] == "_"):
        return False
    for ch in key[1:]:
        if ch.isalnum() or ch == "_":
            continue
        return False
    return True


def _persist_appdata(key: str, value: Any) -> None:
    if not _appdata_key_ok(key):
        return
    val_str = value if isinstance(value, str) else json.dumps(value)
    rec = AppData.query.filter_by(data_key=key).first()
    if rec:
        rec.data_value = val_str
    else:
        db.session.add(AppData(data_key=key, data_value=val_str))


def _appdata_row(key: str) -> Optional[AppData]:
    return AppData.query.filter_by(data_key=key).first()


def _appdata_json_list(key: str) -> Optional[List[Any]]:
    row = _appdata_row(key)
    if not row:
        return None
    try:
        parsed = json.loads(row.data_value or "null")
    except Exception:
        return None
    if isinstance(parsed, list):
        return parsed
    return None


def _appdata_json_value(key: str) -> Any:
    row = _appdata_row(key)
    if not row:
        return None
    try:
        return json.loads(row.data_value or "null")
    except Exception:
        return row.data_value

data_bp = Blueprint("data", __name__, url_prefix="/api/data")
expenses_bp = Blueprint("expenses_api", __name__, url_prefix="/api/expenses")


def _is_mvh(name: str) -> bool:
    s = (name or "").strip().lower()
    if not s:
        return False
    if s in _MVH_SYNONYMS:
        return True
    if "master vacation" in s:
        return True
    if s == "mvh":
        return True
    return False


def _normalize_addr(v: str) -> str:
    return (v or "").strip().lower()


def _next_expense_id() -> str:
    import datetime as _dt

    year = _dt.datetime.utcnow().year
    reg = _appdata_json_list("expense_register") or []
    max_n = 0
    prefix = f"EXP-{year}-"
    for row in reg:
        if not isinstance(row, dict):
            continue
        eid = str(row.get("expense_id") or "")
        if eid.startswith(prefix):
            try:
                n = int(eid[len(prefix):])
                if n > max_n:
                    max_n = n
            except ValueError:
                continue
    return f"{prefix}{max_n + 1:04d}"


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
    if isinstance(rows, list):
        _persist_appdata("appfolio_properties", rows)
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
    if isinstance(rows, list):
        _persist_appdata("appfolio_expenses", rows)
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


@data_bp.post("/save")
def save_appdata_kv():
    payload = request.get_json(silent=True) or {}
    key = _s(payload.get("key"))
    if not key or not _appdata_key_ok(key):
        return jsonify({"error": "invalid key", "success": False}), 400
    value = payload.get("value")
    _persist_appdata(key, value)
    db.session.commit()
    return jsonify({"success": True, "ok": True})


@data_bp.get("/load/<key>")
def load_appdata_kv(key: str):
    k = _s(key)
    if not k or not _appdata_key_ok(k):
        return jsonify({"key": k or key, "value": None, "success": False}), 400
    row = _appdata_row(k)
    if not row:
        return jsonify({"key": k, "value": None, "success": True})
    try:
        val: Any = json.loads(row.data_value or "null")
    except Exception:
        val = row.data_value
    return jsonify({"key": k, "value": val, "success": True})


@data_bp.post("/client-kv-merge")
def client_kv_merge():
    """Merge a partial dict into the shared client_kv blob (debounced UI saves)."""
    payload = request.get_json(silent=True) or {}
    kv = payload.get("client_kv")
    if not isinstance(kv, dict):
        return jsonify({"ok": False, "error": "client_kv object required"}), 400
    _merge_client_kv(kv)
    db.session.commit()
    return jsonify({"ok": True, "success": True})


@data_bp.post("/save-all")
def save_all():
    payload = request.get_json(silent=True) or {}
    properties = payload.get("properties")
    expenses = payload.get("expenses")
    config = payload.get("config") or {}

    prop_count = 0
    exp_count = 0
    if isinstance(properties, list):
        prop_count = len(properties)
        for row in properties:
            if isinstance(row, dict):
                _upsert_property(row)
        _persist_appdata("appfolio_properties", properties)
    if isinstance(expenses, list):
        exp_count = len(expenses)
        for row in expenses:
            if isinstance(row, dict):
                _upsert_expense(row)
        _persist_appdata("appfolio_expenses", expenses)
    if isinstance(config, dict):
        for k, v in config.items():
            key = _s(k)
            if not key:
                continue
            cfg = SiteConfig.query.filter_by(key=key).first() or SiteConfig(key=key)
            cfg.value = json.dumps(v) if not isinstance(v, str) else v
            db.session.add(cfg)

    appdata = payload.get("appdata")
    if isinstance(appdata, dict):
        for k, v in appdata.items():
            ks = _s(k)
            if _appdata_key_ok(ks):
                _persist_appdata(ks, v)

    for ek in _APPDATA_EXTRA_KEYS:
        if ek in payload:
            _persist_appdata(ek, payload.get(ek))

    if isinstance(payload.get("client_kv"), dict):
        _merge_client_kv(payload["client_kv"])

    db.session.commit()

    keys_saved: List[str] = []
    if isinstance(properties, list):
        keys_saved.append("properties")
    if isinstance(expenses, list):
        keys_saved.append("expenses")
    if "config" in payload:
        keys_saved.append("config")
    if isinstance(appdata, dict):
        keys_saved.extend([_s(k) for k in appdata if _appdata_key_ok(_s(k))])
    keys_saved.extend([k for k in _APPDATA_EXTRA_KEYS if k in payload])
    if isinstance(payload.get("client_kv"), dict):
        keys_saved.append("client_kv")

    return jsonify(
        {
            "ok": True,
            "success": True,
            "saved": {
                "properties": prop_count,
                "expenses": exp_count,
                "config": len(config) if isinstance(config, dict) else 0,
            },
            "keys_saved": keys_saved,
        }
    )


_RESERVED_LOAD_KEYS = frozenset({"properties", "expenses", "config"})


@data_bp.get("/load-all")
def load_all():
    props = Property.query.order_by(Property.updated_at.desc(), Property.id.desc()).all()
    exps = Expense.query.order_by(Expense.updated_at.desc(), Expense.id.desc()).all()
    cfg_rows = SiteConfig.query.order_by(SiteConfig.key.asc()).all()
    cfg: Dict[str, Any] = {}
    for r in cfg_rows:
        try:
            cfg[r.key] = json.loads(r.value or "")
        except Exception:
            cfg[r.key] = r.value

    base_props = [_serialize_property(p) for p in props]
    base_exps = [_serialize_expense(e) for e in exps]

    rich_p = _appdata_json_list("appfolio_properties")
    props_out: List[Any] = rich_p if rich_p is not None else base_props

    rich_e = _appdata_json_list("appfolio_expenses")
    exps_out: List[Any] = rich_e if rich_e is not None else base_exps

    out: Dict[str, Any] = {
        "properties": props_out,
        "expenses": exps_out,
        "config": cfg,
        "client_kv": _load_client_kv(),
    }

    for row in AppData.query.order_by(AppData.data_key.asc()).all():
        if row.data_key in ("appfolio_properties", "appfolio_expenses", _CLIENT_KV_ROW_KEY):
            continue
        if row.data_key in _RESERVED_LOAD_KEYS:
            continue
        try:
            out[row.data_key] = json.loads(row.data_value or "null")
        except Exception:
            out[row.data_key] = row.data_value

    return jsonify(out)


@expenses_bp.get("/vendors")
def list_expense_vendors():
    """Return unique vendor names aggregated from manual + imported expenses."""
    vendors: set[str] = set()
    # AppFolio/imported expenses table
    for e in Expense.query.all():
        nm = (e.payee_name or "").strip()
        if nm:
            vendors.add(nm)
    # Imported expenses blob (rich)
    rich = _appdata_json_list("appfolio_expenses") or []
    for row in rich:
        if isinstance(row, dict):
            nm = str(row.get("payee") or row.get("payeeName") or "").strip()
            if nm:
                vendors.add(nm)
    # Manual expenses blob
    manual = _appdata_json_list("manual_expenses") or []
    for row in manual:
        if isinstance(row, dict):
            nm = str(row.get("vendor") or row.get("payeeName") or "").strip()
            if nm:
                vendors.add(nm)
    # Expense register (created via /api/expenses/create)
    reg = _appdata_json_list("expense_register") or []
    for row in reg:
        if isinstance(row, dict):
            nm = str(row.get("vendor") or "").strip()
            if nm:
                vendors.add(nm)
    return jsonify({"success": True, "vendors": sorted(vendors, key=lambda s: s.lower())})


@expenses_bp.post("/create")
def create_expense():
    """Create an expense record and (optionally) deduct its net amount from Owner Payments.

    Body: { vendor, property, category, expense_account, description, expense_date,
            due_date, gross_amount, tax, net_amount, payment_method, cash_account,
            reference, approver_room, notes, attachments, created_by, expense_id }
    """
    payload = request.get_json(silent=True) or {}

    vendor = _s(payload.get("vendor"))
    prop = _s(payload.get("property"))
    category = _s(payload.get("category")) or "Other"
    expense_account = _s(payload.get("expense_account")) or _CATEGORY_TO_ACCOUNT.get(category, "6103")
    description = _s(payload.get("description"))
    expense_date = _s(payload.get("expense_date"))
    due_date = _s(payload.get("due_date"))
    gross_amount = _f(payload.get("gross_amount"))
    tax = _f(payload.get("tax"))
    net_amount = _f(payload.get("net_amount"))
    if net_amount <= 0:
        net_amount = max(0.0, gross_amount - tax)
    payment_method = _s(payload.get("payment_method"))
    cash_account = _s(payload.get("cash_account")) or "1150"
    reference = _s(payload.get("reference"))
    approver_room = _s(payload.get("approver_room"))
    if _is_mvh(vendor):
        approver_room = "Man.Master"
    notes = _s(payload.get("notes"))
    created_by = _s(payload.get("created_by")) or "admin"
    attachments = payload.get("attachments") if isinstance(payload.get("attachments"), list) else []

    errors: List[str] = []
    if not vendor:
        errors.append("vendor is required")
    if not category:
        errors.append("category is required")
    if len(description) < 3:
        errors.append("description must have at least 3 characters")
    if not expense_date:
        errors.append("expense_date is required")
    if gross_amount <= 0:
        errors.append("gross_amount must be greater than 0")
    if tax < 0:
        errors.append("tax must be 0 or greater")
    if net_amount <= 0:
        errors.append("net_amount must be greater than 0")
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # Generate ID (prefer client-provided if valid and unique)
    client_id = _s(payload.get("expense_id"))
    import re as _re

    reg = _appdata_json_list("expense_register") or []
    existing_ids = {str((r or {}).get("expense_id") or "") for r in reg if isinstance(r, dict)}
    if client_id and _re.match(r"^EXP-\d{4}-\d{4}$", client_id) and client_id not in existing_ids:
        expense_id = client_id
    else:
        expense_id = _next_expense_id()

    now_iso = __import__("datetime").datetime.utcnow().isoformat() + "Z"
    record = {
        "expense_id": expense_id,
        "vendor": vendor,
        "property": prop,
        "category": category,
        "expense_account": expense_account,
        "description": description,
        "expense_date": expense_date,
        "due_date": due_date,
        "gross_amount": gross_amount,
        "tax": tax,
        "net_amount": net_amount,
        "payment_method": payment_method,
        "cash_account": cash_account,
        "reference": reference,
        "approver_room": approver_room,
        "notes": notes,
        "attachments": [a for a in attachments if isinstance(a, dict)],
        "is_mvh": _is_mvh(vendor),
        "created_by": created_by,
        "created_at": now_iso,
    }
    reg.insert(0, record)
    _persist_appdata("expense_register", reg)

    # Persist to Expense table for GAAP integration
    _upsert_expense(
        {
            "property": prop,
            "payee": vendor,
            "billDate": expense_date,
            "checkDate": "",
            "expenseAccount": expense_account,
            "cashAccount": cash_account,
            "amount": net_amount,
            "paymentStatus": "Unpaid",
            "reference": reference or expense_id,
            "description": description,
            "source": "manual",
        }
    )

    # Owner Payments integration
    owner_payment_updated = False
    if prop:
        owner_payments = _appdata_json_value("owner_payments") or {}
        if not isinstance(owner_payments, dict):
            owner_payments = {}
        op_log = _appdata_json_list("expense_owner_payment_log") or []
        already = any(
            isinstance(r, dict) and str(r.get("expense_id") or "") == expense_id for r in op_log
        )
        if not already:
            key = _normalize_addr(prop)
            cur = owner_payments.get(key) or {}
            cur_expenses = _f(cur.get("expenses_amount"))
            new_expenses = cur_expenses + net_amount
            cur_rent = _f(cur.get("rent_amount"))
            cur_mgmt = _f(cur.get("mgmt_fee_amount"))
            net_owner = cur_rent - new_expenses - cur_mgmt
            cur.update(
                {
                    "property_address": prop,
                    "owner_name": cur.get("owner_name") or "",
                    "expenses_amount": new_expenses,
                    "expenses_edited": True,
                    "net_owner_amount": net_owner,
                    "net_owner_edited": True,
                    "status": cur.get("status") or "pending",
                }
            )
            owner_payments[key] = cur
            _persist_appdata("owner_payments", owner_payments)
            op_log.insert(
                0,
                {
                    "expense_id": expense_id,
                    "property": prop,
                    "amount": net_amount,
                    "category": category,
                    "expense_account": expense_account,
                    "created_by": created_by,
                    "created_at": now_iso,
                },
            )
            _persist_appdata("expense_owner_payment_log", op_log)
            owner_payment_updated = True

    db.session.commit()
    return jsonify(
        {
            "success": True,
            "expense_id": expense_id,
            "owner_payment_updated": owner_payment_updated,
            "record": record,
        }
    )
