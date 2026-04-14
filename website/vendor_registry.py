"""GodManager Premium — vendor registry (CRUD, trades, documents, checklist)."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

_WEB_DIR = Path(__file__).resolve().parent
VENDORS_PATH = _WEB_DIR / "data" / "vendors_registry.json"
TRADES_PATH = _WEB_DIR / "data" / "vendor_trades.json"
VENDOR_DOCS_ROOT = _WEB_DIR / "data" / "vendor_documents"

DEFAULT_TRADES: List[str] = [
    "Plumbing",
    "Electrical",
    "HVAC",
    "General Maintenance",
    "Landscaping",
    "Pool Service",
    "Painting",
    "Cleaning",
    "Pest Control",
    "Roofing",
    "Flooring",
    "Appliance Repair",
    "Locksmith",
    "Garage Door",
    "Drywall",
    "Pressure Washing",
    "Tree Service",
    "Fencing",
    "Concrete",
    "HOA Management",
    "Property Inspection",
    "Photography",
    "Moving Services",
    "Junk Removal",
    "Fire/Smoke Restoration",
    "Water Damage Restoration",
    "Mold Remediation",
    "Carpet Cleaning",
    "Window Cleaning",
    "Gutter Cleaning",
    "Other",
]

CHECKLIST_KEYS: Tuple[str, ...] = (
    "name_registered",
    "address_complete",
    "email_verified",
    "phone_verified",
    "w9_uploaded",
    "bank_info_uploaded",
    "workers_comp_uploaded",
    "liability_insurance_uploaded",
    "auto_insurance_uploaded",
    "state_license_uploaded",
    "contract_signed",
)

DOC_TYPES_FOR_CHECKLIST = {
    "w9": "w9_uploaded",
    "bank_info": "bank_info_uploaded",
    "workers_comp": "workers_comp_uploaded",
    "liability_insurance": "liability_insurance_uploaded",
    "auto_insurance": "auto_insurance_uploaded",
    "state_license": "state_license_uploaded",
    "contract": "contract_signed",
}


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _ensure_dirs() -> None:
    VENDORS_PATH.parent.mkdir(parents=True, exist_ok=True)
    VENDOR_DOCS_ROOT.mkdir(parents=True, exist_ok=True)


def _load_json(path: Path, default: Any) -> Any:
    _ensure_dirs()
    if not path.exists():
        path.write_text(json.dumps(default, indent=2), encoding="utf-8")
        return json.loads(json.dumps(default))
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        path.write_text(json.dumps(default, indent=2), encoding="utf-8")
        return json.loads(json.dumps(default))


def _save_json(path: Path, data: Any) -> None:
    _ensure_dirs()
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _load_trades() -> List[str]:
    raw = _load_json(TRADES_PATH, {})
    trades = raw.get("trades") if isinstance(raw, dict) else None
    if not isinstance(trades, list) or len(trades) == 0:
        trades = list(DEFAULT_TRADES)
        _save_json(TRADES_PATH, {"trades": trades})
    return [str(t).strip() for t in trades if str(t).strip()]


def _save_trades(trades: List[str]) -> None:
    uniq: List[str] = []
    seen = set()
    for t in trades:
        s = str(t).strip()
        if not s or s.lower() in seen:
            continue
        seen.add(s.lower())
        uniq.append(s)
    _save_json(TRADES_PATH, {"trades": uniq})


def _load_store() -> Dict[str, Any]:
    d = _load_json(VENDORS_PATH, {"next_id": 1, "vendors": []})
    if "next_id" not in d:
        d["next_id"] = 1
    if "vendors" not in d:
        d["vendors"] = []
    return d


def _save_store(store: Dict[str, Any]) -> None:
    _save_json(VENDORS_PATH, store)


def _vendor_dir(vid: int) -> Path:
    return VENDOR_DOCS_ROOT / str(int(vid))


def _mask_routing(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    if len(s) <= 4:
        return "****"
    return "*" * max(0, len(s) - 4) + s[-4:]


def _mask_account(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    if len(s) <= 4:
        return "****"
    return "*" * max(0, len(s) - 4) + s[-4:]


def _sensitive_unchanged_sent(val: Any) -> bool:
    """Empty or masked placeholder from client means do not overwrite."""
    s = "" if val is None else str(val).strip()
    if not s:
        return True
    if "*" in s:
        return True
    return False


def _parse_date(s: Any) -> Optional[datetime]:
    if s is None or s == "":
        return None
    t = str(s).strip()[:10]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    return None


def _expiry_bucket(iso: str) -> str:
    """'valid' | 'expiring_soon' | 'expired' | 'none'"""
    dt = _parse_date(iso)
    if not dt:
        return "none"
    today = datetime.now().date()
    d = dt.date()
    if d < today:
        return "expired"
    if d <= today + timedelta(days=60):
        return "expiring_soon"
    return "valid"


def _is_expiring_30_days(iso: str) -> bool:
    dt = _parse_date(iso)
    if not dt:
        return False
    today = datetime.now().date()
    d = dt.date()
    if d < today:
        return True
    return d <= today + timedelta(days=30)


def _vendor_has_expiring_soon(v: Dict[str, Any]) -> bool:
    fields = (
        "workers_comp_expiration",
        "liability_insurance_expiration",
        "auto_insurance_expiration",
        "epa_certification_expiration",
        "state_license_expiration",
        "contract_expiration",
    )
    for f in fields:
        if _is_expiring_30_days(str(v.get(f) or "")):
            return True
    return False


def _checklist_from_vendor(v: Dict[str, Any]) -> Dict[str, bool]:
    docs = v.get("documents") or []
    doc_types = {str(d.get("type") or "").lower() for d in docs if isinstance(d, dict)}
    cl = {k: False for k in CHECKLIST_KEYS}
    if (v.get("company_name") or "").strip():
        cl["name_registered"] = True
    if (
        (v.get("address_street") or "").strip()
        and (v.get("address_city") or "").strip()
        and (v.get("address_state") or "").strip()
        and (v.get("address_zip") or "").strip()
    ):
        cl["address_complete"] = True
    if (v.get("email") or "").strip():
        cl["email_verified"] = True
    if (v.get("phone") or "").strip():
        cl["phone_verified"] = True
    if "w9" in doc_types:
        cl["w9_uploaded"] = True
    if "bank_info" in doc_types:
        cl["bank_info_uploaded"] = True
    if "workers_comp" in doc_types:
        cl["workers_comp_uploaded"] = True
    if "liability_insurance" in doc_types:
        cl["liability_insurance_uploaded"] = True
    if v.get("auto_insurance_na"):
        cl["auto_insurance_uploaded"] = True
    elif "auto_insurance" in doc_types:
        cl["auto_insurance_uploaded"] = True
    if v.get("state_license_na"):
        cl["state_license_uploaded"] = True
    elif "state_license" in doc_types:
        cl["state_license_uploaded"] = True
    if "contract" in doc_types:
        cl["contract_signed"] = True
    return cl


def _checklist_done_count(cl: Dict[str, bool]) -> int:
    return sum(1 for k in CHECKLIST_KEYS if cl.get(k))


def _public_vendor(v: Dict[str, Any], *, mask: bool = True) -> Dict[str, Any]:
    out = dict(v)
    if mask:
        rn = out.get("routing_number")
        an = out.get("account_number")
        out["routing_number"] = _mask_routing(str(rn or "")) if rn else ""
        out["account_number"] = _mask_account(str(an or "")) if an else ""
    out["checklist"] = _checklist_from_vendor(v)
    out["checklist_done"] = _checklist_done_count(out["checklist"])
    out["checklist_total"] = len(CHECKLIST_KEYS)
    return out


def _find_vendor(store: Dict[str, Any], vid: int) -> Optional[Dict[str, Any]]:
    for x in store.get("vendors") or []:
        if int(x.get("id") or 0) == int(vid):
            return x
    return None


def _apply_vendor_payload(target: Dict[str, Any], body: Dict[str, Any], *, is_create: bool) -> None:
    str_fields = (
        "company_name",
        "contact_first_name",
        "contact_last_name",
        "email",
        "phone",
        "phone_secondary",
        "address_street",
        "address_city",
        "address_state",
        "address_zip",
        "website",
        "notes",
        "trade",
        "trade_secondary",
        "ein_tax_id",
        "payment_type",
        "bank_name",
        "account_type",
        "default_gl_account",
        "workers_comp_expiration",
        "workers_comp_policy",
        "liability_insurance_expiration",
        "liability_insurance_policy",
        "auto_insurance_expiration",
        "epa_certification_expiration",
        "state_license_number",
        "state_license_expiration",
        "contract_expiration",
        "status",
    )
    for f in str_fields:
        if f in body and body[f] is not None:
            target[f] = str(body[f]).strip()
    if "send_1099" in body:
        target["send_1099"] = bool(body.get("send_1099"))
    if "vendor_portal_activated" in body:
        target["vendor_portal_activated"] = bool(body.get("vendor_portal_activated"))
    if "rating" in body:
        try:
            r = int(body.get("rating"))
            target["rating"] = max(1, min(5, r))
        except (TypeError, ValueError):
            pass
    if "liability_insurance_amount" in body and body["liability_insurance_amount"] is not None:
        try:
            target["liability_insurance_amount"] = float(body.get("liability_insurance_amount"))
        except (TypeError, ValueError):
            target["liability_insurance_amount"] = 0.0
    if "auto_insurance_na" in body:
        target["auto_insurance_na"] = bool(body.get("auto_insurance_na"))
    if "state_license_na" in body:
        target["state_license_na"] = bool(body.get("state_license_na"))
    if not _sensitive_unchanged_sent(body.get("routing_number")):
        target["routing_number"] = str(body.get("routing_number") or "").strip()
    if not _sensitive_unchanged_sent(body.get("account_number")):
        target["account_number"] = str(body.get("account_number") or "").strip()
    if "checklist" in body and isinstance(body["checklist"], dict):
        # optional manual overrides stored (merged); still recomputed on read for auto keys
        cur = target.get("checklist") if isinstance(target.get("checklist"), dict) else {}
        merged = dict(cur)
        for k in CHECKLIST_KEYS:
            if k in body["checklist"]:
                merged[k] = bool(body["checklist"][k])
        target["checklist"] = merged


def _blank_vendor() -> Dict[str, Any]:
    now = _iso_now()
    return {
        "company_name": "",
        "contact_first_name": "",
        "contact_last_name": "",
        "email": "",
        "phone": "",
        "phone_secondary": "",
        "address_street": "",
        "address_city": "",
        "address_state": "",
        "address_zip": "",
        "website": "",
        "notes": "",
        "trade": "",
        "trade_secondary": "",
        "ein_tax_id": "",
        "payment_type": "",
        "bank_name": "",
        "routing_number": "",
        "account_number": "",
        "account_type": "",
        "send_1099": False,
        "default_gl_account": "",
        "workers_comp_expiration": "",
        "workers_comp_policy": "",
        "liability_insurance_expiration": "",
        "liability_insurance_policy": "",
        "liability_insurance_amount": 0.0,
        "auto_insurance_expiration": "",
        "epa_certification_expiration": "",
        "state_license_number": "",
        "state_license_expiration": "",
        "contract_expiration": "",
        "checklist": {},
        "documents": [],
        "status": "pending_review",
        "vendor_portal_activated": False,
        "rating": 3,
        "auto_insurance_na": False,
        "state_license_na": False,
        "created_at": now,
        "updated_at": now,
    }


def register_vendor_routes(bp: Blueprint) -> None:
    @bp.route("/vendors/trades", methods=["GET"])
    def vendor_trades_get():
        return jsonify({"trades": _load_trades()})

    @bp.route("/vendors/trades", methods=["POST"])
    def vendor_trades_post():
        data = request.get_json(silent=True) or {}
        name = str(data.get("name") or data.get("trade") or "").strip()
        if not name:
            return jsonify({"error": "name required"}), 400
        trades = _load_trades()
        low = name.lower()
        if not any(t.lower() == low for t in trades):
            trades.append(name)
            _save_trades(trades)
        return jsonify({"ok": True, "trades": _load_trades()})

    @bp.route("/vendors/list", methods=["GET"])
    def vendor_registry_list():
        store = _load_store()
        q_trade = (request.args.get("trade") or "").strip().lower()
        q_status = (request.args.get("status") or "").strip().lower()
        q_search = (request.args.get("search") or "").strip().lower()
        try:
            page = max(1, int(request.args.get("page") or 1))
        except ValueError:
            page = 1
        try:
            limit = min(100, max(1, int(request.args.get("limit") or 20)))
        except ValueError:
            limit = 20
        rows: List[Dict[str, Any]] = []
        for v in store.get("vendors") or []:
            if q_status and str(v.get("status") or "").lower() != q_status:
                continue
            if q_trade:
                t1 = str(v.get("trade") or "").lower()
                t2 = str(v.get("trade_secondary") or "").lower()
                if q_trade not in t1 and q_trade not in t2:
                    continue
            blob = json.dumps(v).lower()
            cn = str(v.get("company_name") or "").lower()
            em = str(v.get("email") or "").lower()
            cf = str(v.get("contact_first_name") or "").lower()
            cl = str(v.get("contact_last_name") or "").lower()
            if q_search and q_search not in blob and q_search not in cn and q_search not in em:
                if q_search not in f"{cf} {cl}".strip():
                    continue
            rows.append(_public_vendor(v, mask=True))
        rows.sort(key=lambda x: -int(x.get("id") or 0))
        total = len(rows)
        start = (page - 1) * limit
        chunk = rows[start : start + limit]
        total_pages = max(1, (total + limit - 1) // limit)
        active = sum(1 for v in store.get("vendors") or [] if str(v.get("status")) == "active")
        pending = sum(
            1
            for v in store.get("vendors") or []
            if _checklist_done_count(_checklist_from_vendor(v)) < len(CHECKLIST_KEYS)
        )
        expiring = sum(1 for v in store.get("vendors") or [] if _vendor_has_expiring_soon(v))
        return jsonify(
            {
                "vendors": chunk,
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages,
                "summary": {
                    "total": len(store.get("vendors") or []),
                    "active": active,
                    "pending_review": pending,
                    "expiring_soon": expiring,
                },
            }
        )

    @bp.route("/vendors/register", methods=["POST"])
    def vendor_register():
        body = request.get_json(silent=True) or {}
        if not str(body.get("company_name") or "").strip():
            return jsonify({"error": "company_name required"}), 400
        if not str(body.get("email") or "").strip():
            return jsonify({"error": "email required"}), 400
        if not str(body.get("phone") or "").strip():
            return jsonify({"error": "phone required"}), 400
        if not str(body.get("address_street") or "").strip():
            return jsonify({"error": "address_street required"}), 400
        store = _load_store()
        vid = int(store["next_id"])
        v = _blank_vendor()
        v["id"] = vid
        _apply_vendor_payload(v, body, is_create=True)
        store["vendors"].append(v)
        store["next_id"] = vid + 1
        v["updated_at"] = _iso_now()
        _save_store(store)
        _vendor_dir(vid).mkdir(parents=True, exist_ok=True)
        return jsonify({"ok": True, "vendor": _public_vendor(v, mask=True)})

    @bp.route("/vendors/<int:vendor_id>", methods=["GET"])
    def vendor_get(vendor_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        return jsonify(_public_vendor(v, mask=True))

    @bp.route("/vendors/<int:vendor_id>", methods=["PUT"])
    def vendor_put(vendor_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        body = request.get_json(silent=True) or {}
        _apply_vendor_payload(v, body, is_create=False)
        v["updated_at"] = _iso_now()
        _save_store(store)
        return jsonify({"ok": True, "vendor": _public_vendor(v, mask=True)})

    @bp.route("/vendors/<int:vendor_id>", methods=["DELETE"])
    def vendor_delete(vendor_id: int):
        store = _load_store()
        nv = [x for x in store.get("vendors") or [] if int(x.get("id") or 0) != int(vendor_id)]
        if len(nv) == len(store.get("vendors") or []):
            return jsonify({"error": "not found"}), 404
        store["vendors"] = nv
        _save_store(store)
        d = _vendor_dir(vendor_id)
        if d.is_dir():
            shutil.rmtree(str(d), ignore_errors=True)
        return jsonify({"ok": True})

    @bp.route("/vendors/<int:vendor_id>/documents", methods=["GET"])
    def vendor_docs_list(vendor_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        docs = v.get("documents") or []
        return jsonify({"documents": docs})

    @bp.route("/vendors/<int:vendor_id>/documents", methods=["POST"])
    def vendor_docs_upload(vendor_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        doc_type = (request.form.get("type") or "").strip().lower()
        if doc_type not in DOC_TYPES_FOR_CHECKLIST:
            return jsonify({"error": "invalid type", "allowed": list(DOC_TYPES_FOR_CHECKLIST.keys())}), 400
        if "file" not in request.files:
            return jsonify({"error": "file required"}), 400
        f = request.files["file"]
        if not f or not f.filename:
            return jsonify({"error": "empty file"}), 400
        _vendor_dir(vendor_id).mkdir(parents=True, exist_ok=True)
        safe = secure_filename(f.filename) or "upload"
        docs = v.get("documents")
        if not isinstance(docs, list):
            docs = []
        next_doc_id = max((int(d.get("id") or 0) for d in docs if isinstance(d, dict)), default=0) + 1
        disk_name = f"{next_doc_id}_{doc_type}_{safe}"
        dest = _vendor_dir(vendor_id) / disk_name
        f.save(str(dest))
        entry = {
            "id": next_doc_id,
            "filename": safe,
            "stored_name": disk_name,
            "type": doc_type,
            "uploaded_at": _iso_now(),
        }
        docs = [d for d in docs if not (isinstance(d, dict) and str(d.get("type") or "").lower() == doc_type)]
        docs.append(entry)
        v["documents"] = docs
        v["updated_at"] = _iso_now()
        _save_store(store)
        return jsonify({"ok": True, "document": entry})

    @bp.route("/vendors/<int:vendor_id>/documents/<int:doc_id>", methods=["DELETE"])
    def vendor_doc_delete(vendor_id: int, doc_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        docs = v.get("documents") if isinstance(v.get("documents"), list) else []
        found = None
        rest: List[Dict[str, Any]] = []
        for d in docs:
            if isinstance(d, dict) and int(d.get("id") or 0) == int(doc_id):
                found = d
            else:
                rest.append(d)
        if not found:
            return jsonify({"error": "document not found"}), 404
        sn = str(found.get("stored_name") or "")
        if sn:
            fp = (_vendor_dir(vendor_id) / sn)
            try:
                if fp.is_file():
                    fp.unlink()
            except OSError:
                pass
        v["documents"] = rest
        v["updated_at"] = _iso_now()
        _save_store(store)
        return jsonify({"ok": True})

    @bp.route("/vendors/<int:vendor_id>/documents/<int:doc_id>/file", methods=["GET"])
    def vendor_doc_file(vendor_id: int, doc_id: int):
        store = _load_store()
        v = _find_vendor(store, vendor_id)
        if not v:
            return jsonify({"error": "not found"}), 404
        for d in v.get("documents") or []:
            if isinstance(d, dict) and int(d.get("id") or 0) == int(doc_id):
                sn = str(d.get("stored_name") or "")
                if not sn:
                    break
                fp = (_vendor_dir(vendor_id) / sn).resolve()
                base = _vendor_dir(vendor_id).resolve()
                try:
                    if not str(fp).startswith(str(base)):
                        return jsonify({"error": "invalid"}), 400
                except OSError:
                    return jsonify({"error": "invalid"}), 400
                if not fp.is_file():
                    return jsonify({"error": "not found"}), 404
                return send_file(str(fp), as_attachment=False, download_name=str(d.get("filename") or "file"))
        return jsonify({"error": "not found"}), 404
