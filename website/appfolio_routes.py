"""AppFolio CSV import + JSON APIs for GodManager Premium dashboard."""
from __future__ import annotations

import base64
import csv
import hashlib
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, DefaultDict, Dict, List, Optional, Tuple

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

_WEB_DIR = Path(__file__).resolve().parent
DATA_DIR = _WEB_DIR / "data" / "appfolio"
META_PATH = DATA_DIR / "_appfolio_meta.json"
GROSS_EXPENSES_PATH = DATA_DIR / "gross_expenses.json"
ORG_CHART_PATH = DATA_DIR / "org_chart.json"
TENANTS_REGISTRY_PATH = _WEB_DIR / "data" / "tenants.json"
TENANT_DOCS_DIR = _WEB_DIR / "data" / "tenant_docs"
APPROVAL_LOGS_PATH = _WEB_DIR / "data" / "approval_logs.json"
LT_EXP_APPROVAL_STATE_PATH = _WEB_DIR / "data" / "lt_expense_approval_state.json"

_LT_EXP_STEP_NAMES: Dict[int, str] = {
    1: "Invoice Received",
    2: "Registered in AppFolio",
    3: "Approved",
}

CANONICAL_FILES = {
    "property_directory": "property_directory.csv",
    "tenant_directory": "tenant_directory.csv",
    "owner_directory": "owner_directory.csv",
    "vendor_directory": "vendor_directory.csv",
    "bill_detail": "bill_detail.csv",
    "income_register": "income_register.csv",
    "unpaid_balances_by_month": "unpaid_balances_by_month.csv",
    "owner_1099_detail": "owner_1099_detail.csv",
}

# (substring in filename, canonical internal key)
_FILENAME_MATCH_ORDER: List[Tuple[str, str]] = [
    ("owner_1099_detail", "owner_1099_detail"),
    ("owner_1099", "owner_1099_detail"),
    ("unpaid_balances_by_month", "unpaid_balances_by_month"),
    ("unpaid_balances", "unpaid_balances_by_month"),
    ("property_directory", "property_directory"),
    ("tenant_directory", "tenant_directory"),
    ("owner_directory", "owner_directory"),
    ("vendor_directory", "vendor_directory"),
    ("bill_detail", "bill_detail"),
    ("income_register", "income_register"),
]

appfolio_bp = Blueprint("appfolio", __name__, url_prefix="/api/appfolio")

_FL_CITY_ZIP = re.compile(r",\s*([A-Za-z][A-Za-z\s\.\'-]+),\s*FL\s+(\d{5})(?:\s|$|,)", re.I)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _norm_label(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _norm_city(s: str) -> str:
    if not s:
        return ""
    return str(s).strip().title()


def _norm_county(s: str) -> str:
    """Lake County / LAKE / lake -> Lake."""
    if not s:
        return ""
    t = str(s).strip()
    t = re.sub(r"\s+county\s*$", "", t, flags=re.I).strip()
    return t.title()


def _parse_percent(val: Any) -> float:
    """Management fee like '7.98%' or '7.98'."""
    if val is None:
        return 0.0
    s = str(val).strip().replace("%", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _extract_gl_code(gl_raw: str) -> str:
    m = re.match(r"\s*(\d{4})\b", (gl_raw or "").strip())
    return m.group(1) if m else ""


def _is_gl_owner_distribution(gl_raw: str) -> bool:
    return "3250" in (gl_raw or "").lower()


# GL code (4 digits) -> SG&A category label (AppFolio bill_detail)
SGA_LABEL_BY_CODE: Dict[str, str] = {
    "6112": "Tenant Placement Fees",
    "6075": "HOA Dues",
    "6076": "Cleaning & Maintenance",
    "6073": "General Maintenance",
    "6144": "HVAC",
    "6141": "Painting",
    "6074": "Landscaping",
    "6142": "Plumbing",
    "7010": "Appliances",
    "6103": "Other",
    "6111": "Management Fees",
}

SGA_DISPLAY_ORDER: List[str] = [
    "Tenant Placement Fees",
    "HOA Dues",
    "Cleaning & Maintenance",
    "General Maintenance",
    "HVAC",
    "Painting",
    "Landscaping",
    "Plumbing",
    "Appliances",
    "Management Fees",
    "Other",
]


def parse_money(val: Any) -> float:
    if val is None:
        return 0.0
    s = str(val).strip()
    if not s or s.lower() in ("-", "n/a", "na"):
        return 0.0
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    s = re.sub(r"[^\d.\-]", "", s.replace(",", ""))
    if not s or s == ".":
        return 0.0
    try:
        x = float(s)
        return -x if neg else x
    except ValueError:
        return 0.0


def _header_map(fieldnames: Optional[List[str]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not fieldnames:
        return out
    for h in fieldnames:
        if h is None:
            continue
        out[_norm_label(h)] = h
    return out


def _get(row: Dict[str, str], hmap: Dict[str, str], *candidates: str) -> str:
    for c in candidates:
        k = _norm_label(c)
        orig = hmap.get(k)
        if orig is not None:
            v = row.get(orig)
            if v is not None and str(v).strip() != "":
                return str(v).strip()
    for c in candidates:
        ck = _norm_label(c)
        for nk, orig in hmap.items():
            if ck == nk or ck in nk or nk in ck:
                v = row.get(orig)
                if v is not None and str(v).strip() != "":
                    return str(v).strip()
    return ""


def _read_csv_raw(path: Path) -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    if not path.exists():
        return [], {}
    encodings = ("utf-8-sig", "utf-8", "cp1252", "latin-1")
    last_err: Optional[Exception] = None
    for enc in encodings:
        try:
            with path.open(newline="", encoding=enc) as f:
                reader = csv.DictReader(f)
                rows = [
                    dict(r)
                    for r in reader
                    if any((v or "").strip() for v in (r or {}).values())
                ]
                hmap = _header_map(reader.fieldnames)
                return rows, hmap
        except UnicodeDecodeError as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    return [], {}


def _filter_rows(
    rows: List[Dict[str, str]],
    hmap: Dict[str, str],
    skip: Callable[[Dict[str, str], Dict[str, str]], bool],
) -> List[Dict[str, str]]:
    return [r for r in rows if not skip(r, hmap)]


def _city_from_property_field(prop_val: str) -> str:
    if not prop_val:
        return ""
    m = _FL_CITY_ZIP.search(prop_val)
    if m:
        return _norm_city(m.group(1))
    return ""


def _property_key_tenant(row: Dict[str, str], hmap: Dict[str, str]) -> str:
    """AppFolio tenant rows: Property column is canonical full string."""
    p = _get(row, hmap, "Property", "Property Name", "Property Address")
    if p:
        return re.sub(r"\s+", " ", p).strip().lower()
    return _property_key_generic(row, hmap)


def _property_key_generic(row: Dict[str, str], hmap: Dict[str, str]) -> str:
    parts = [
        _get(row, hmap, "Property", "Property Name", "Property Address", "Address", "Street"),
        _get(row, hmap, "Unit", "Unit Number", "Unit #"),
        _get(row, hmap, "City", "Property City"),
        _get(row, hmap, "State", "Property State"),
        _get(row, hmap, "Zip", "Zip Code", "Postal Code"),
    ]
    key = " | ".join(x for x in parts if x).strip()
    if key:
        return re.sub(r"\s+", " ", key).lower()
    return "__unknown__"


def _lease_id_from_property_key(pk: str) -> str:
    if pk == "__unknown__":
        return "lease_unknown"
    h = hashlib.sha256(pk.encode("utf-8")).hexdigest()[:14]
    return f"lease_{h}"


def _tenant_status(raw: str) -> str:
    s = (raw or "").strip().upper()
    if "CURRENT" in s or s == "CUR":
        return "CURRENT"
    if "NOTICE" in s:
        return "NOTICE"
    if "FUTURE" in s:
        return "FUTURE"
    if "PAST" in s or "FORMER" in s:
        return "PAST"
    return s or "UNKNOWN"


def detect_csv_type(filename: str) -> Optional[str]:
    base = Path(filename).name.lower().replace(" ", "_").replace("-", "_")
    for needle, canonical in _FILENAME_MATCH_ORDER:
        if needle in base:
            return canonical
    return None


def _load_meta() -> Dict[str, Any]:
    if not META_PATH.exists():
        return {}
    try:
        return json.loads(META_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_meta(meta: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def _iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _parse_date_mmddyyyy(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _pagination_params() -> Tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", "1")))
    except ValueError:
        page = 1
    try:
        limit = min(500, max(1, int(request.args.get("limit", "20"))))
    except ValueError:
        limit = 20
    return page, limit


def _paginate(items: List[Any]) -> Dict[str, Any]:
    page, limit = _pagination_params()
    total = len(items)
    start = (page - 1) * limit
    chunk = items[start : start + limit]
    total_pages = (total + limit - 1) // limit if limit else 1
    return {
        "items": chunk,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
    }


# --- typed loaders ----------------------------------------------------------


def _load_properties() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["property_directory"])


def _load_tenants() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["tenant_directory"])


def _load_owners() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["owner_directory"])


def _load_vendors() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["vendor_directory"])


def _bill_is_group_header(r: Dict[str, str], hm: Dict[str, str]) -> bool:
    ref = (_get(r, hm, "Reference") or "").strip()
    if ref.startswith("->"):
        return True
    if not ref:
        for v in (r or {}).values():
            if str(v).strip().startswith("->"):
                return True
    return False


def _load_bills_filtered() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    rows, h = _read_csv_raw(DATA_DIR / CANONICAL_FILES["bill_detail"])
    rows = _filter_rows(rows, h, _bill_is_group_header)
    return rows, h


def _load_income() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["income_register"])


def _load_unpaid() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    return _read_csv_raw(DATA_DIR / CANONICAL_FILES["unpaid_balances_by_month"])


def _1099_is_group_header(r: Dict[str, str], hm: Dict[str, str]) -> bool:
    """AppFolio group rows: only Owner Name starting with '->' (ignore as headers)."""
    on = (_get(r, hm, "Owner Name", "Owner", "OwnerName") or "").strip()
    return on.startswith("->")


def _1099_amount_from_row(r: Dict[str, str], hmap: Dict[str, str]) -> float:
    v = parse_money(
        _get(
            r,
            hmap,
            "1099 Amount",
            "Amount 1099",
            "Box 1",
            "Form 1099 Amount",
            "Total 1099 Amount",
            "1099 Total",
            "Total 1099",
            "Box Amount",
            "Payments 1099",
        )
    )
    if v > 0.005:
        return v
    for orig in (r or {}).keys():
        nk = _norm_label(orig or "")
        if "1099" in nk and ("amount" in nk or "box" in nk or "payment" in nk or "total" in nk):
            v2 = parse_money(r.get(orig))
            if v2 > 0.005:
                return v2
    return 0.0


def _1099_amount_detail_line(r: Dict[str, str], hmap: Dict[str, str]) -> float:
    """
    1099 Amount for hierarchical exports: primary columns only on detail rows.
    If amount is zero in standard columns, fall back to fuzzy column scan only when
    Property Name is present (detail line), never on owner-only header rows.
    """
    v = parse_money(
        _get(
            r,
            hmap,
            "1099 Amount",
            "Amount 1099",
            "Box 1",
            "Form 1099 Amount",
            "Total 1099 Amount",
            "1099 Total",
            "Total 1099",
        )
    )
    if v > 0.005:
        return v
    prop = (_get(r, hmap, "Property Name", "Property", "Property Address") or "").strip()
    if not prop:
        return 0.0
    for orig in (r or {}).keys():
        nk = _norm_label(orig or "")
        if "1099" in nk and ("amount" in nk or "box" in nk or "payment" in nk or "total" in nk):
            v2 = parse_money(r.get(orig))
            if v2 > 0.005:
                return v2
    return 0.0


def _aggregate_owner_1099_hierarchical(
    rows: List[Dict[str, str]], hmap: Dict[str, str]
) -> Tuple[float, set[str]]:
    """
    CSV is hierarchical: owner header row(s) with name + tax form, then detail rows
    with Property / Ownership Period / 1099 Amount. Detail rows may omit Owner Name;
    attribute amounts to the last owner seen (non-empty Owner Name, not a '->' group line).

    - Skip rows where Owner Name starts with '->' (already filtered in load, but safe).
    - Sum 1099 Amount only from detail lines (amount > 0).
    - Count unique owners that have at least one detail line with amount > 0.
    """
    current_owner_key = ""
    total = 0.0
    owners_positive: set[str] = set()
    for r in rows:
        on_raw = _get(r, hmap, "Owner Name", "Owner", "OwnerName")
        if (on_raw or "").strip().startswith("->"):
            continue
        name_stripped = (on_raw or "").strip()
        if name_stripped:
            current_owner_key = name_stripped.lower()
        amt = _1099_amount_detail_line(r, hmap)
        if amt > 0.005:
            total += amt
            ok = current_owner_key or _owner_1099_key(r, hmap)
            if ok:
                owners_positive.add(ok)
    return round(total, 2), owners_positive


def _owner_1099_key(r: Dict[str, str], hmap: Dict[str, str]) -> str:
    on = _get(
        r,
        hmap,
        "Owner Name",
        "Owner",
        "Owner Taxpayer Name",
        "Taxpayer Name",
        "Payee Name",
        "Legal Name",
    )
    return on.strip().lower()


def _load_1099_filtered() -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    rows, h = _read_csv_raw(DATA_DIR / CANONICAL_FILES["owner_1099_detail"])
    rows = _filter_rows(rows, h, _1099_is_group_header)
    return rows, h


def _unpaid_current_month_orig(rows: List[Dict[str, str]]) -> str:
    """Last month-like column in row key order (e.g. 'April - 2026'), per AppFolio export layout."""
    if not rows:
        return ""
    skip_norm = {"property", "unit", "tenant", "total_unpaid_balance", "tags", "name"}
    last = ""
    for col in rows[0].keys():
        nk = _norm_label(col or "")
        if nk in skip_norm:
            continue
        if "total" in nk and "unpaid" in nk and "balance" in nk:
            continue
        if re.search(r"(19|20)\d{2}", col or ""):
            last = col or ""
    return last


def _property_row_geo(
    r: Dict[str, str], hmap: Dict[str, str]
) -> Tuple[str, str, str]:
    county = _norm_county(_get(r, hmap, "County", "Property County", "County Name"))
    city = _norm_city(_get(r, hmap, "City", "Property City"))
    prop_full = _get(r, hmap, "Property", "Property Name", "Property Address")
    if not city and prop_full:
        city = _city_from_property_field(prop_full)
    return county, city, prop_full


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


def _parse_date_any(val: Any) -> Optional[datetime]:
    """Parse common AppFolio / ISO date strings to naive datetime (date part)."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    candidates = [s.split("T", 1)[0], s.split(" ", 1)[0], s[:10]]
    seen: set[str] = set()
    for cand in candidates:
        cand = cand.strip()
        if not cand or cand in seen:
            continue
        seen.add(cand)
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
            try:
                return datetime.strptime(cand[:10], fmt)
            except ValueError:
                continue
    return _parse_date_mmddyyyy(s)


def _push_dash_alert(
    out: List[Dict[str, Any]],
    *,
    severity: str,
    category: str,
    title: str,
    detail: str,
    link: str,
) -> None:
    if len(out) >= 120:
        return
    out.append(
        {
            "severity": severity,
            "category": category,
            "title": (title or "")[:180],
            "detail": (detail or "")[:400],
            "link": link or "#longterm",
            "created_at": _iso_now() + "Z",
        }
    )


def _build_dashboard_alerts(
    *,
    now: datetime,
    prop_rows: List[Dict[str, str]],
    prop_h: Dict[str, str],
    ten_rows: List[Dict[str, str]],
    ten_h: Dict[str, str],
    own_rows: List[Dict[str, str]],
    own_h: Dict[str, str],
    ven_rows: List[Dict[str, str]],
    ven_h: Dict[str, str],
    bill_rows: List[Dict[str, str]],
    bill_h: Dict[str, str],
    up_rows: List[Dict[str, str]],
    up_h: Dict[str, str],
    occupied_props: Any,
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    occ: set[str] = set(occupied_props) if isinstance(occupied_props, set) else set()

    # --- Properties: vacant (no current tenant on property) ---
    vacant_keys_set: set[str] = set()
    for r in prop_rows:
        pk = _property_key_tenant(r, prop_h)
        if pk and pk != "__unknown__" and pk not in occ:
            vacant_keys_set.add(pk)
    for pk in list(vacant_keys_set)[:40]:
        label = pk[:80] + ("…" if len(pk) > 80 else "")
        _push_dash_alert(
            alerts,
            severity="warning",
            category="property",
            title="Vacant property",
            detail=label,
            link="#ltproperties",
        )

    # --- Property: management agreement ending (60d) ---
    for r in prop_rows:
        end_raw = _get(
            r,
            prop_h,
            "Management Agreement End",
            "Management End Date",
            "Agreement End Date",
            "Contract End Date",
        )
        end_d = _parse_date_any(end_raw)
        if end_d and (end_d - now).days <= 60 and (end_d - now).days >= 0:
            pname = _get(r, prop_h, "Property", "Property Name", "Property Address") or "Property"
            _push_dash_alert(
                alerts,
                severity="info",
                category="property",
                title="Management agreement expiring",
                detail=f"{pname} — ends {end_raw}",
                link="#ltproperties",
            )

    # --- Tenants: unpaid balance (unpaid_balances CSV) ---
    for r in up_rows:
        amt = parse_money(
            _get(r, up_h, "Total Unpaid Balance", "Total Unpaid", "Unpaid Balance", "Balance", "Total")
        )
        if amt <= 0.005:
            continue
        tenant = _get(r, up_h, "Tenant", "Tenant Name", "Name")
        prop = _get(r, up_h, "Property", "Property Name", "Unit")
        detail = f"{tenant or '—'} @ {prop or '—'} — ${amt:,.2f}"
        _push_dash_alert(
            alerts,
            severity="urgent",
            category="tenant",
            title="Unpaid balance",
            detail=detail,
            link="#tenants",
        )

    # --- Tenants: lease end / notice / future ---
    for r in ten_rows:
        status = _tenant_status(_get(r, ten_h, "Status", "Lease Status"))
        lease_end_raw = _get(
            r,
            ten_h,
            "Lease End",
            "Lease End Date",
            "End Date",
            "Move-Out Date",
            "Move Out Date",
        )
        lease_end = _parse_date_any(lease_end_raw)
        tname = _get(r, ten_h, "Tenant", "Tenant Name", "Name") or "Tenant"
        prop = _get(r, ten_h, "Property", "Property Name") or ""

        if status == "CURRENT" and lease_end and lease_end.date() < now.date():
            _push_dash_alert(
                alerts,
                severity="urgent",
                category="tenant",
                title="Lease expired (still Current)",
                detail=f"{tname} — {prop}",
                link="#tenants",
            )
        elif lease_end:
            days = (lease_end.date() - now.date()).days
            if 0 <= days <= 30:
                _push_dash_alert(
                    alerts,
                    severity="warning",
                    category="tenant",
                    title="Lease expiring",
                    detail=f"{tname} — {lease_end_raw} ({days}d)",
                    link="#tenants",
                )
        if status == "NOTICE":
            _push_dash_alert(
                alerts,
                severity="warning",
                category="tenant",
                title="Tenant on Notice",
                detail=f"{tname} — {prop}",
                link="#tenants",
            )
        if status == "FUTURE":
            move_in = _get(r, ten_h, "Move-In Date", "Move In Date", "Start Date", "Lease Start")
            _push_dash_alert(
                alerts,
                severity="info",
                category="tenant",
                title="Future tenant (scheduled move-in)",
                detail=f"{tname} — {move_in or prop}",
                link="#tenants",
            )

    # --- Owners ---
    for r in own_rows:
        nm = _get(r, own_h, "Owner Name", "Owner", "Name", "Legal Name") or "Owner"
        hold = (_get(r, own_h, "Hold Payments", "Hold Owner Payments", "Hold Disbursements") or "").strip().lower()
        if hold in ("yes", "y", "true", "1", "on"):
            _push_dash_alert(
                alerts,
                severity="urgent",
                category="owner",
                title="Owner payments on hold",
                detail=nm,
                link="#ownerportal",
            )
        last_pay_raw = _get(
            r,
            own_h,
            "Last Payment Date",
            "Last Distribution Date",
            "Last Owner Distribution",
            "Last Payment",
        )
        last_pay = _parse_date_any(last_pay_raw)
        if last_pay:
            days_since = (now.date() - last_pay.date()).days
            if days_since > 60:
                _push_dash_alert(
                    alerts,
                    severity="warning",
                    category="owner",
                    title="No owner payment in 60+ days",
                    detail=f"{nm} — last {last_pay_raw}",
                    link="#ownerportal",
                )
            elif 0 <= days_since <= 14:
                _push_dash_alert(
                    alerts,
                    severity="info",
                    category="owner",
                    title="Owner payment processed",
                    detail=f"{nm} — {last_pay_raw}",
                    link="#ownerportal",
                )

    # --- Vendors: insurance / contract expirations ---
    for r in ven_rows:
        vname = _get(r, ven_h, "Vendor Name", "Vendor", "Name", "Payee") or "Vendor"
        for label, keys, link in (
            ("Liability insurance", ("Liability Insurance Expiration", "Liability Insurance End"), "#vendors"),
            ("Workers comp", ("Workers Compensation Expiration", "Workers Comp Expiration"), "#vendors"),
            ("Vendor contract", ("Contract End Date", "Agreement End Date"), "#vendors"),
        ):
            raw = _get(r, ven_h, *keys)
            exp = _parse_date_any(raw)
            if not exp:
                continue
            if exp.date() < now.date():
                _push_dash_alert(
                    alerts,
                    severity="urgent",
                    category="vendor",
                    title=f"{label} expired",
                    detail=f"{vname} — was {raw}",
                    link=link,
                )
            elif 0 <= (exp.date() - now.date()).days <= 30:
                _push_dash_alert(
                    alerts,
                    severity="warning",
                    category="vendor",
                    title=f"{label} expiring",
                    detail=f"{vname} — {raw}",
                    link=link,
                )

    # --- Bills ---
    for r in bill_rows:
        unpaid = parse_money(_get(r, bill_h, "Unpaid", "Open Balance", "Balance"))
        if unpaid <= 0.005:
            continue
        due_raw = _get(r, bill_h, "Due Date", "Due", "Bill Date", "Date")
        due = _parse_date_any(due_raw)
        ref = _get(r, bill_h, "Reference", "Bill Number", "Memo") or "Bill"
        payee = _get(r, bill_h, "Payee Name", "Payee", "Vendor") or ""
        detail = f"{payee} — ${unpaid:,.2f} — due {due_raw}"
        if due and due.date() < now.date():
            _push_dash_alert(
                alerts,
                severity="urgent",
                category="bill",
                title="Overdue bill (unpaid)",
                detail=detail,
                link="#ltexpenses",
            )
        elif due:
            dd = (due.date() - now.date()).days
            if 0 <= dd <= 15:
                _push_dash_alert(
                    alerts,
                    severity="warning",
                    category="bill",
                    title="Bill due soon (unpaid)",
                    detail=detail + f" ({dd}d)",
                    link="#ltexpenses",
                )

    return alerts


def _compute_dashboard() -> Dict[str, Any]:
    meta = _load_meta()
    prop_rows, prop_h = _load_properties()
    ten_rows, ten_h = _load_tenants()
    own_rows, own_h = _load_owners()
    ven_rows, ven_h = _load_vendors()
    bill_rows, bill_h = _load_bills_filtered()
    inc_rows, inc_h = _load_income()
    up_rows, up_h = _load_unpaid()
    rows1099, h1099 = _load_1099_filtered()

    total_properties = len(prop_rows)

    by_prop: DefaultDict[str, List[Dict[str, str]]] = defaultdict(list)
    for r in ten_rows:
        pk = _property_key_tenant(r, ten_h)
        by_prop[pk].append(r)

    occupied_props: set[str] = set()
    future_props: set[str] = set()
    notice_props: set[str] = set()
    current_tenant_rows = 0
    past_tenant_rows = 0

    rent_by_prop: Dict[str, float] = {}
    dep_by_prop: Dict[str, float] = {}

    for pk, rows in by_prop.items():
        if pk == "__unknown__":
            continue
        rents: List[float] = []
        deps: List[float] = []
        has_cur = has_fut = has_not = False
        for r in rows:
            st = _tenant_status(_get(r, ten_h, "Status", "Lease Status"))
            rent = parse_money(_get(r, ten_h, "Rent", "Monthly Rent", "Scheduled Rent"))
            dep = parse_money(_get(r, ten_h, "Deposit", "Security Deposit", "Security Deposit Held"))
            if rent > 0:
                rents.append(rent)
            if dep > 0:
                deps.append(dep)
            if st == "CURRENT":
                has_cur = True
                current_tenant_rows += 1
            elif st == "PAST":
                past_tenant_rows += 1
            elif st == "FUTURE":
                has_fut = True
            elif st == "NOTICE":
                has_not = True
        if has_cur:
            occupied_props.add(pk)
            rent_by_prop[pk] = max(rents) if rents else 0.0
            dep_by_prop[pk] = max(deps) if deps else 0.0
        if has_fut:
            future_props.add(pk)
        if has_not:
            notice_props.add(pk)

    occupied_units = len(occupied_props)
    vacant_units = max(0, total_properties - occupied_units)
    occupancy_rate = round(100.0 * occupied_units / total_properties, 1) if total_properties else 0.0

    monthly_rent = round(sum(rent_by_prop.values()), 2)
    total_deposits = round(sum(dep_by_prop.values()), 2)
    avg_rent = round(monthly_rent / occupied_units, 2) if occupied_units else 0.0

    rent_vals = [v for v in rent_by_prop.values() if v > 0]
    rent_min = round(min(rent_vals), 2) if rent_vals else 0.0
    rent_max = round(max(rent_vals), 2) if rent_vals else 0.0

    leases_future = len(future_props - occupied_props)
    leases_notice = len({p for p in notice_props if p in occupied_props})
    qty_notice = len(notice_props)
    qty_future = len(future_props)

    total_owners = len(own_rows)
    total_vendors = len(ven_rows)

    owners_with_leased_prop: set[str] = set()
    for r in prop_rows:
        pk = _property_key_tenant(r, prop_h)
        if pk == "__unknown__" or pk not in occupied_props:
            continue
        oline = _get(r, prop_h, "Owner(s)", "Owner", "Owner Name", "Property Owner")
        t = (oline or "").strip()
        if t:
            owners_with_leased_prop.add(re.sub(r"\s+", " ", t).lower())
    qty_owners_with_lease = len(owners_with_leased_prop)
    qty_owners_pending = max(0, total_owners - qty_owners_with_lease)

    # Unpaid: group by property short name
    unpaid_total = 0.0
    unpaid_by_propname: DefaultDict[str, float] = defaultdict(float)
    for r in up_rows:
        amt = parse_money(_get(r, up_h, "Total Unpaid Balance", "Total Unpaid", "Unpaid Balance", "Balance"))
        if amt == 0:
            amt = parse_money(_get(r, up_h, "Total", "Amount"))
        pname = _get(r, up_h, "Property", "Property Name") or "__unknown__"
        unpaid_by_propname[pname.strip().lower()] += amt
        unpaid_total += amt
    properties_with_unpaid = sum(1 for _k, v in unpaid_by_propname.items() if v > 0.005)

    # Income: receipts + account-specific metrics
    total_income = 0.0
    rent_income = 0.0
    operating_cash = 0.0
    late_fees_collected = 0.0
    security_deposit_cash_in = 0.0
    for r in inc_rows:
        rec = parse_money(
            _get(r, inc_h, "Receipt Amount", "Receipt", "Receipts", "Income", "Credit")
        )
        total_income += rec
        chg = parse_money(_get(r, inc_h, "Charge Amount", "Charge", "Charges"))
        acct = _get(r, inc_h, "Cash Account", "Income Account", "Account", "GL Account")
        al = (acct or "").lower()
        if "4100" in al.replace(" ", "") and "rent" in al:
            rent_income += chg
        if "1150" in al.replace(" ", "") and "operating" in al and "cash" in al:
            operating_cash += rec
        if "4460" in al.replace(" ", "") and "late" in al:
            late_fees_collected += chg
        if "1160" in al.replace(" ", "") and "security" in al and "deposit" in al:
            security_deposit_cash_in += rec

    # Bills: vendor totals exclude GL 3250 (owner distributions)
    total_bills_paid = 0.0
    total_bills_unpaid = 0.0
    owner_distributions = 0.0
    total_vendor_spend = 0.0
    total_vendor_unpaid = 0.0
    qty_vendor_work_orders = 0
    cleaning_maintenance_paid = 0.0
    cleaning_maintenance_unpaid = 0.0
    contractor_payroll_paid = 0.0
    contractor_payroll_unpaid = 0.0
    total_bills_count = 0
    bills_with_paid = 0
    bills_with_unpaid = 0
    bills_count_resolved = 0
    bills_count_open = 0
    bills_count_in_progress = 0
    sga_buckets: Dict[str, Dict[str, Any]] = {
        label: {"paid": 0.0, "unpaid": 0.0, "count": 0} for label in SGA_DISPLAY_ORDER
    }
    payee_totals: DefaultDict[str, float] = defaultdict(float)
    for r in bill_rows:
        paid = parse_money(_get(r, bill_h, "Paid", "Paid Amount", "Amount Paid"))
        unpaid = parse_money(_get(r, bill_h, "Unpaid", "Open Balance", "Balance"))
        gl_raw = _get(r, bill_h, "GL Account", "Account", "GL")
        gl = (gl_raw or "").lower()
        payee = _get(r, bill_h, "Payee Name", "Payee", "Vendor", "Vendor Name")
        total_bills_paid += paid
        total_bills_unpaid += unpaid
        if _is_gl_owner_distribution(gl_raw or ""):
            owner_distributions += paid
            continue
        qty_vendor_work_orders += 1
        total_bills_count += 1
        if paid > 0.005:
            bills_with_paid += 1
        if unpaid > 0.005:
            bills_with_unpaid += 1
        if paid > 0.005 and unpaid <= 0.005:
            bills_count_resolved += 1
        elif unpaid > 0.005 and paid <= 0.005:
            bills_count_open += 1
        elif paid > 0.005 and unpaid > 0.005:
            bills_count_in_progress += 1
        total_vendor_spend += paid
        total_vendor_unpaid += unpaid
        code = _extract_gl_code(gl_raw or "")
        if code == "6076":
            cleaning_maintenance_paid += paid
            cleaning_maintenance_unpaid += unpaid
        if code in ("6073", "6112"):
            contractor_payroll_paid += paid
            contractor_payroll_unpaid += unpaid
        label = SGA_LABEL_BY_CODE.get(code, "Other")
        if label not in sga_buckets:
            label = "Other"
        sga_buckets[label]["paid"] += paid
        sga_buckets[label]["unpaid"] += unpaid
        sga_buckets[label]["count"] += 1
        if payee and paid > 0:
            payee_totals[payee] += paid

    total_sga = round(total_vendor_spend + total_vendor_unpaid, 2)

    top_payees = [
        {"payee": k, "total_paid": round(v, 2)}
        for k, v in sorted(payee_totals.items(), key=lambda x: -x[1])[:15]
    ]

    # 1099 totals (hierarchical CSV: amounts on detail rows; owners from context)
    total_1099, owners_1099_positive_set = _aggregate_owner_1099_hierarchical(
        rows1099, h1099
    )
    owners_1099_positive = len(owners_1099_positive_set)

    # Geo + mgmt fee from property directory
    properties_by_county: Dict[str, int] = defaultdict(int)
    properties_by_city: Dict[str, int] = defaultdict(int)
    mgmt_fee_breakdown: Dict[str, int] = defaultdict(int)
    market_rent_total = 0.0
    mgmt_fee_pcts: List[float] = []
    for r in prop_rows:
        county, city, prop_full = _property_row_geo(r, prop_h)
        market_rent_total += parse_money(
            _get(r, prop_h, "Market Rent", "Market Rental Rate", "Market Rent Amount")
        )
        p_pct = _parse_percent(_get(r, prop_h, "Management Fee Percent", "Management Fee %", "Management Fee"))
        if p_pct > 0:
            mgmt_fee_pcts.append(p_pct)
        if county:
            properties_by_county[county] += 1
        if city:
            properties_by_city[city] += 1
        elif prop_full:
            c2 = _city_from_property_field(prop_full)
            if c2:
                properties_by_city[c2] += 1
        pct = _get(r, prop_h, "Management Fee Percent", "Management Fee %", "Management Fee")
        pct = pct.strip() if pct else ""
        if pct:
            mgmt_fee_breakdown[pct] += 1

    avg_mgmt_fee_pct = round(sum(mgmt_fee_pcts) / len(mgmt_fee_pcts), 2) if mgmt_fee_pcts else 0.0
    mgmt_fee_revenue_potential = round(monthly_rent * avg_mgmt_fee_pct / 100.0, 2)

    sga_breakdown_out: Dict[str, Dict[str, Any]] = {}
    for label in SGA_DISPLAY_ORDER:
        b = sga_buckets.get(
            label, {"paid": 0.0, "unpaid": 0.0, "count": 0}
        )
        sga_breakdown_out[label] = {
            "paid": round(b["paid"], 2),
            "unpaid": round(b["unpaid"], 2),
            "count": int(b["count"]),
        }

    last_upload = meta.get("last_upload")

    # Ramp (corporate cards) — placeholder until Ramp API is connected
    ramp_total_spend = 0.0
    ramp_by_category: Dict[str, float] = {
        "Operations": 0.0,
        "SG&A": 0.0,
        "Maintenance": 0.0,
        "Other": 0.0,
    }
    ramp_connected = False

    # Inspections (Zen Inspector) — estimated from portfolio + debit flow assumptions
    n_props = max(1, total_properties)
    inspections_est_monthly = max(1, int(round(n_props / 6.0)))
    inspections_total = inspections_est_monthly
    inspections_completed = 10
    inspections_scheduled = 4
    inspections_overdue = 2
    inspection_cost_monthly = 80.0
    inspections_connected = False

    now_alerts = datetime.now(timezone.utc).replace(tzinfo=None)
    alerts_out = _build_dashboard_alerts(
        now=now_alerts,
        prop_rows=prop_rows,
        prop_h=prop_h,
        ten_rows=ten_rows,
        ten_h=ten_h,
        own_rows=own_rows,
        own_h=own_h,
        ven_rows=ven_rows,
        ven_h=ven_h,
        bill_rows=bill_rows,
        bill_h=bill_h,
        up_rows=up_rows,
        up_h=up_h,
        occupied_props=occupied_props,
    )

    return {
        "total_properties": total_properties,
        "occupied_units": occupied_units,
        "vacant_units": vacant_units,
        "occupancy_rate": occupancy_rate,
        "total_tenants": current_tenant_rows,
        "tenants_past": past_tenant_rows,
        "leases_future": leases_future,
        "leases_notice": leases_notice,
        "total_owners": total_owners,
        "total_vendors": total_vendors,
        "monthly_rent": monthly_rent,
        "avg_rent": avg_rent,
        "rent_min": rent_min,
        "rent_max": rent_max,
        "total_deposits": round(total_deposits, 2),
        "unpaid_balance": round(unpaid_total, 2),
        "properties_with_unpaid": properties_with_unpaid,
        "total_income": round(total_income, 2),
        "total_bills_paid": round(total_bills_paid, 2),
        "total_bills_unpaid": round(total_bills_unpaid, 2),
        "owner_distributions": round(owner_distributions, 2),
        "total_1099": round(total_1099, 2),
        "owners_1099_positive": owners_1099_positive,
        "properties_by_county": dict(sorted(properties_by_county.items(), key=lambda x: (-x[1], x[0]))),
        "properties_by_city": dict(sorted(properties_by_city.items(), key=lambda x: (-x[1], x[0]))),
        "mgmt_fee_breakdown": dict(sorted(mgmt_fee_breakdown.items(), key=lambda x: (-x[1], x[0]))),
        "top_payees": top_payees,
        "last_upload": last_upload,
        # compat keys for older frontends
        "rent_range": {"min": int(round(rent_min)), "max": int(round(rent_max))},
        # GodManager Premium Home KPIs (explicit names)
        "qty_properties": total_properties,
        "qty_leases_active": occupied_units,
        "qty_tenants_people": current_tenant_rows,
        "qty_owners": total_owners,
        "qty_vendors": total_vendors,
        "qty_vendor_work_orders": qty_vendor_work_orders,
        "qty_vacant": vacant_units,
        "qty_notice": qty_notice,
        "qty_future": qty_future,
        "potential_rent_monthly": round(monthly_rent, 2),
        "market_rent_total": round(market_rent_total, 2),
        "total_income_received": round(total_income, 2),
        "rent_income": round(rent_income, 2),
        "operating_cash": round(operating_cash, 2),
        "late_fees_collected": round(late_fees_collected, 2),
        "security_deposit_cash_in": round(security_deposit_cash_in, 2),
        "total_vendor_spend": round(total_vendor_spend, 2),
        "total_vendor_unpaid": round(total_vendor_unpaid, 2),
        "total_sga": total_sga,
        "sga_breakdown": sga_breakdown_out,
        "avg_mgmt_fee_pct": avg_mgmt_fee_pct,
        "mgmt_fee_revenue_potential": mgmt_fee_revenue_potential,
        "total_security_deposits": round(total_deposits, 2),
        # Home cards (cleaning / contractor / bills)
        "cleaning_maintenance_paid": round(cleaning_maintenance_paid, 2),
        "cleaning_maintenance_unpaid": round(cleaning_maintenance_unpaid, 2),
        "cleaning_maintenance_total": round(
            cleaning_maintenance_paid + cleaning_maintenance_unpaid, 2
        ),
        "contractor_payroll_paid": round(contractor_payroll_paid, 2),
        "contractor_payroll_unpaid": round(contractor_payroll_unpaid, 2),
        "total_bills_count": total_bills_count,
        "bills_with_paid": bills_with_paid,
        "bills_with_unpaid": bills_with_unpaid,
        "bills_count_resolved": bills_count_resolved,
        "bills_count_open": bills_count_open,
        "bills_count_in_progress": bills_count_in_progress,
        "total_vendor_spend_all": total_sga,
        "qty_owners_with_lease": qty_owners_with_lease,
        "qty_owners_pending": qty_owners_pending,
        # Home cards — Ramp & Inspections
        "ramp_total_spend": round(ramp_total_spend, 2),
        "ramp_by_category": ramp_by_category,
        "ramp_connected": ramp_connected,
        "inspections_total": inspections_total,
        "inspections_completed": inspections_completed,
        "inspections_scheduled": inspections_scheduled,
        "inspections_overdue": inspections_overdue,
        "inspection_cost_monthly": round(inspection_cost_monthly, 2),
        "inspections_connected": inspections_connected,
        "alerts": alerts_out,
    }


def _import_summary_counts() -> Dict[str, int]:
    """Human-readable counts after files on disk."""
    pr, _ = _load_properties()
    tr, _ = _load_tenants()
    orows, _ = _load_owners()
    vr, _ = _load_vendors()
    br, _ = _load_bills_filtered()
    ir, _ = _load_income()
    ur, _ = _load_unpaid()
    r9, _ = _load_1099_filtered()
    dash = _compute_dashboard()
    return {
        "properties": len(pr),
        "tenants_people": dash["total_tenants"],
        "owners": len(orows),
        "vendors": len(vr),
        "bills": len(br),
        "income": len(ir),
        "unpaid": len(ur),
        "owners_1099": dash["owners_1099_positive"],
        "leases_active": dash["occupied_units"],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@appfolio_bp.route("/upload", methods=["POST"])
def upload_csvs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    files = request.files.getlist("files")
    if not files or all(not getattr(f, "filename", None) for f in files):
        files = [f for f in request.files.values() if getattr(f, "filename", None)]

    summary: Dict[str, Any] = {"imported": {}, "imported_rows": {}, "errors": [], "skipped": []}
    meta = _load_meta()
    imports = meta.get("imports") or {}

    for f in files:
        fn = getattr(f, "filename", "") or ""
        if not fn:
            continue
        kind = detect_csv_type(fn)
        if not kind:
            summary["skipped"].append({"filename": fn, "reason": "unknown_csv_type"})
            continue
        dest_name = CANONICAL_FILES.get(kind)
        if not dest_name:
            summary["skipped"].append({"filename": fn, "reason": "unmapped_type"})
            continue
        dest = DATA_DIR / dest_name
        try:
            data = f.read()
            if not data:
                summary["errors"].append({"filename": fn, "error": "empty_file"})
                continue
            dest.write_bytes(data)
            # Count data rows (respect filters for bills / 1099)
            if kind == "bill_detail":
                rows, _ = _load_bills_filtered()
            elif kind == "owner_1099_detail":
                rows, _ = _load_1099_filtered()
            else:
                rows, _ = _read_csv_raw(dest)
                rows = [x for x in rows if any((v or "").strip() for v in x.values())]
            n = len(rows)
            summary["imported_rows"][kind] = n
            imports[kind] = {"rows": n, "at": _iso_now(), "filename": fn}
        except OSError as e:
            summary["errors"].append({"filename": fn, "error": str(e)})

    meta["last_upload"] = _iso_now()
    meta["imports"] = imports
    _save_meta(meta)
    summary["last_upload"] = meta["last_upload"]

    summary["imported"] = _import_summary_counts()
    return jsonify(summary)


@appfolio_bp.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify(_compute_dashboard())


@appfolio_bp.route("/properties", methods=["GET"])
def properties_list():
    rows, h = _load_properties()
    county_q = (request.args.get("county") or "").strip()
    city_q = (request.args.get("city") or "").strip()
    search_q = (request.args.get("search") or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for r in rows:
        county, city, prop_full = _property_row_geo(r, h)
        pname = _get(r, h, "Property Name", "Property", "Name")
        if county_q and county.lower() != _norm_county(county_q).lower():
            continue
        if city_q and city.lower() != _norm_city(city_q).lower():
            continue
        blob = " ".join(
            str(x).lower() for x in (pname, prop_full, county, city) if x
        )
        if search_q and search_q not in blob:
            continue
        _prop_key_src = f"{pname}|{prop_full}|{county}|{city}"
        _prop_stable_id = hashlib.sha256(_prop_key_src.encode("utf-8")).hexdigest()[:20]
        out.append(
            {
                "id": _prop_stable_id,
                "property": prop_full or pname,
                "property_name": pname,
                "address": _get(r, h, "Property Street Address 1", "Address", "Street"),
                "city": city,
                "county": county,
                "state": _get(r, h, "State", "Property State"),
                "zip": _get(r, h, "Zip", "Zip Code", "Postal Code", "Property Zip"),
                "owner": _get(r, h, "Owner(s)", "Owner", "Owner Name", "Property Owner"),
                "owner_phones": _get(r, h, "Owner(s) - Phone Numbers", "Owner Phone"),
                "market_rent": parse_money(_get(r, h, "Market Rent", "Market Rental Rate")),
                "sqft": _get(r, h, "Sqft", "Square Feet", "Sq Ft", "SF"),
                "units": _get(r, h, "Units", "Unit Count"),
                "management_fee_percent": _get(r, h, "Management Fee Percent", "Management Fee %"),
                "portfolio": _get(r, h, "Portfolio"),
                "property_type": _get(r, h, "Property Type"),
            }
        )
    pg = _paginate(out)
    pg["properties"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/tenants", methods=["GET"])
def tenants_list():
    rows, h = _load_tenants()
    status_q = (request.args.get("status") or "").strip().upper()

    by_prop: DefaultDict[str, List[Tuple[int, Dict[str, str]]]] = defaultdict(list)
    for i, r in enumerate(rows):
        pk = _property_key_tenant(r, h)
        by_prop[pk].append((i, r))

    out: List[Dict[str, Any]] = []
    for pk in sorted(by_prop.keys()):
        group = sorted(by_prop[pk], key=lambda x: x[0])
        lid = _lease_id_from_property_key(pk)
        for idx, (_i, r) in enumerate(group):
            st = _tenant_status(_get(r, h, "Status", "Lease Status"))
            if status_q and st != status_q:
                continue
            out.append(
                {
                    "lease_id": lid,
                    "property_key": pk,
                    "property": _get(r, h, "Property", "Property Name"),
                    "unit": _get(r, h, "Unit"),
                    "tenant_name": _get(r, h, "Tenant", "Tenant Name", "Name"),
                    "tenant_type": _get(r, h, "Tenant Type"),
                    "status": st,
                    "rent": parse_money(_get(r, h, "Rent", "Monthly Rent")),
                    "deposit": parse_money(_get(r, h, "Deposit", "Security Deposit")),
                    "move_in": _get(r, h, "Move-in", "Move In", "Move In Date", "Lease From"),
                    "lease_to": _get(r, h, "Lease To", "Lease End", "End Date"),
                    "email": _get(r, h, "Emails", "Email", "E-mail"),
                    "phone": _get(r, h, "Phone Numbers", "Phone", "Mobile"),
                    "is_primary": idx == 0,
                }
            )
    pg = _paginate(out)
    pg["tenants"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/owners", methods=["GET"])
def owners_list():
    rows, h = _load_owners()
    search_q = (request.args.get("search") or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for r in rows:
        name = _get(r, h, "Name", "Owner", "Owner Name", "Legal Name")
        if search_q and search_q not in name.lower():
            continue
        out.append(
            {
                "name": name,
                "email": _get(r, h, "Email", "E-mail"),
                "phone": _get(r, h, "Phone Numbers", "Phone", "Mobile"),
                "payment_type": _get(r, h, "Payment Type", "Payment Method"),
                "last_payment_date": _get(r, h, "Last Payment Date", "Last Payment"),
                "properties_owned": _get(r, h, "Properties Owned", "Properties"),
                "address": _get(r, h, "Address"),
                "alternative_payee": _get(r, h, "Alternative Payee"),
            }
        )
    pg = _paginate(out)
    pg["owners"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/vendors", methods=["GET"])
def vendors_list():
    rows, h = _load_vendors()
    search_q = (request.args.get("search") or "").strip().lower()
    has_1099 = (request.args.get("has_1099") or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for r in rows:
        company = _get(r, h, "Company Name", "Company", "Vendor")
        contact = _get(r, h, "Name", "Contact Name")
        s1099 = (_get(r, h, "Send 1099?", "Send 1099", "1099") or "").strip().lower()
        if search_q:
            blob = f"{company} {contact}".lower()
            if search_q not in blob:
                continue
        if has_1099 == "true":
            if s1099 not in ("yes", "y", "true", "1"):
                continue
        out.append(
            {
                "company_name": company,
                "contact_name": contact,
                "phone": _get(r, h, "Phone Numbers", "Phone"),
                "email": _get(r, h, "Email", "E-mail"),
                "default_gl_account": _get(r, h, "Default GL Account", "GL Account"),
                "payment_type": _get(r, h, "Payment Type"),
                "send_1099": _get(r, h, "Send 1099?", "Send 1099"),
                "vendor_portal": _get(r, h, "Vendor Portal Activated?", "Vendor Portal Activated"),
                "address": _get(r, h, "Address"),
            }
        )
    pg = _paginate(out)
    pg["vendors"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/bills", methods=["GET"])
def bills_list():
    rows, h = _load_bills_filtered()
    gl_q = (request.args.get("gl_account") or "").strip().lower()
    payee_q = (request.args.get("payee") or "").strip().lower()
    status_q = (request.args.get("status") or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for r in rows:
        payee = _get(r, h, "Payee Name", "Payee", "Vendor")
        gl = _get(r, h, "GL Account", "Account", "GL")
        prop = _get(r, h, "Property", "Property Name")
        paid = parse_money(_get(r, h, "Paid", "Paid Amount", "Amount Paid"))
        unpaid = parse_money(_get(r, h, "Unpaid", "Open Balance", "Balance"))
        desc = _get(r, h, "Description", "Memo")
        bill_date = _get(r, h, "Bill Date", "Date", "Invoice Date")
        paid_date = _get(r, h, "Paid Date", "Date Paid")
        is_paid = paid > 0 or bool((paid_date or "").strip())
        is_unpaid = unpaid > 0.005
        if gl_q and gl_q not in gl.lower():
            continue
        if payee_q and payee_q not in payee.lower():
            continue
        if status_q == "paid" and not is_paid:
            continue
        if status_q == "unpaid" and not is_unpaid:
            continue
        out.append(
            {
                "payee": payee,
                "gl_account": gl,
                "property": prop,
                "bill_date": bill_date,
                "due_date": _get(r, h, "Due Date"),
                "paid": paid,
                "unpaid": unpaid,
                "paid_date": paid_date,
                "description": desc,
                "reference": _get(r, h, "Reference"),
            }
        )
    pg = _paginate(out)
    pg["bills"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/income", methods=["GET"])
def income_list():
    rows, h = _load_income()
    account_q = (request.args.get("account") or "").strip().lower()
    date_from = _parse_date_mmddyyyy(request.args.get("date_from") or "")
    date_to = _parse_date_mmddyyyy(request.args.get("date_to") or "")
    out: List[Dict[str, Any]] = []
    for r in rows:
        acct = _get(r, h, "Cash Account", "Income Account", "Account", "GL Account")
        if account_q and account_q not in acct.lower():
            continue
        d_raw = _get(r, h, "Received Date", "Invoice Date", "Date", "Transaction Date", "Posted Date")
        dt = _parse_date_mmddyyyy(d_raw)
        if date_from and (not dt or dt < date_from):
            continue
        if date_to and (not dt or dt > date_to):
            continue
        out.append(
            {
                "type": _get(r, h, "Type"),
                "reference": _get(r, h, "Reference"),
                "property": _get(r, h, "Property", "Property Name"),
                "unit": _get(r, h, "Unit"),
                "payer": _get(r, h, "Payer"),
                "date": d_raw,
                "account": acct,
                "receipt_amount": parse_money(_get(r, h, "Receipt Amount", "Receipt", "Receipts")),
                "charge_amount": parse_money(_get(r, h, "Charge Amount", "Charge", "Charges")),
                "description": _get(r, h, "Description", "Memo"),
            }
        )
    pg = _paginate(out)
    pg["income"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/unpaid", methods=["GET"])
def unpaid_list():
    rows, h = _load_unpaid()
    orig_month = _unpaid_current_month_orig(rows)
    out: List[Dict[str, Any]] = []
    for r in rows:
        tenant = _get(r, h, "Tenant", "Tenant Name", "Name")
        prop = _get(r, h, "Property", "Property Name")
        unit = _get(r, h, "Unit")
        total_unpaid = parse_money(
            _get(r, h, "Total Unpaid Balance", "Total Unpaid", "Unpaid Balance", "Balance")
        )
        cur_m = 0.0
        if orig_month:
            cur_m = parse_money(r.get(orig_month, ""))
        out.append(
            {
                "property": prop,
                "unit": unit,
                "tenant": tenant,
                "total_unpaid": total_unpaid,
                "current_month_label": orig_month or "",
                "current_month_balance": cur_m,
            }
        )
    out.sort(key=lambda x: -x["total_unpaid"])
    pg = _paginate(out)
    pg["unpaid"] = pg.pop("items")
    pg["current_month_column"] = orig_month or ""
    return jsonify(pg)


@appfolio_bp.route("/1099", methods=["GET"])
def report_1099():
    rows, h = _load_1099_filtered()
    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "owner_name": _get(r, h, "Owner Name", "Owner"),
                "owner_taxpayer_name": _get(r, h, "Owner Taxpayer Name", "Taxpayer Name"),
                "tax_form_account": _get(r, h, "Tax Form Account Number", "Account Number"),
                "property_name": _get(r, h, "Property Name", "Property"),
                "ownership_period": _get(r, h, "Ownership Period Within Tax Year", "Ownership Period"),
                "total_operating_income": parse_money(
                    _get(r, h, "Total Operating Income", "Operating Income")
                ),
                "prepaid_rent": parse_money(_get(r, h, "Prepaid Rent")),
                "amount_1099": parse_money(_get(r, h, "1099 Amount", "Amount 1099")),
            }
        )
    pg = _paginate(out)
    pg["owner_1099"] = pg.pop("items")
    return jsonify(pg)


# ---------------------------------------------------------------------------
# Gross & Expenses (Manager Prop LLC — configurável)
# ---------------------------------------------------------------------------


def _default_gross_expenses_items() -> List[Dict[str, Any]]:
    return [
        {
            "id": 1,
            "type": "gross",
            "order": 1,
            "name": "Tenant Placement",
            "description": "80% de 1 aluguel",
            "value": "80%",
            "frequency": "por evento",
            "active": True,
            "notes": "",
        },
        {
            "id": 2,
            "type": "gross",
            "order": 2,
            "name": "Management Fee",
            "description": "Taxa de gestao mensal",
            "value": "8%",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 3,
            "type": "gross",
            "order": 3,
            "name": "Apply Fee",
            "description": "Paga $45 ao AppFolio, recebe $50 do tenant",
            "value": "$50",
            "frequency": "por evento",
            "active": True,
            "notes": "Lucro: $5 por aplicacao",
        },
        {
            "id": 4,
            "type": "gross",
            "order": 4,
            "name": "Preparation Fee",
            "description": "Taxa de preparacao do imovel",
            "value": "$150",
            "frequency": "por evento",
            "active": True,
            "notes": "",
        },
        {
            "id": 5,
            "type": "gross",
            "order": 5,
            "name": "Renovation",
            "description": "$200 owner + $200 prop",
            "value": "$400",
            "frequency": "por evento",
            "active": True,
            "notes": "",
        },
        {
            "id": 6,
            "type": "gross",
            "order": 6,
            "name": "Pet Fee",
            "description": "Taxa unica de pet",
            "value": "$400",
            "frequency": "uma vez",
            "active": False,
            "notes": "Depende da propriedade",
        },
        {
            "id": 7,
            "type": "gross",
            "order": 7,
            "name": "Limpeza",
            "description": "Limpeza padrao",
            "value": "$70",
            "frequency": "por evento",
            "active": True,
            "notes": "",
        },
        {
            "id": 8,
            "type": "gross",
            "order": 8,
            "name": "Foto",
            "description": "Sessao fotografica do imovel",
            "value": "$75",
            "frequency": "por evento",
            "active": True,
            "notes": "",
        },
        {
            "id": 9,
            "type": "gross",
            "order": 9,
            "name": "HOA",
            "description": "Taxa de HOA repassada",
            "value": "2%",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 10,
            "type": "debit",
            "order": 1,
            "name": "Ramp",
            "description": "Cartao corporativo",
            "value": "",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 11,
            "type": "debit",
            "order": 2,
            "name": "Operations",
            "description": "Custos operacionais gerais",
            "value": "",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 12,
            "type": "debit",
            "order": 3,
            "name": "SG&A",
            "description": "Selling, General & Administrative",
            "value": "",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 13,
            "type": "debit",
            "order": 4,
            "name": "AppFolio",
            "description": "Software de property management",
            "value": "$46",
            "frequency": "mensal",
            "active": True,
            "notes": "Expira 07/2026",
        },
        {
            "id": 14,
            "type": "debit",
            "order": 5,
            "name": "APM Help",
            "description": "Servico de bookkeeping (Syndi Co)",
            "value": "$2,560",
            "frequency": "mensal",
            "active": True,
            "notes": "",
        },
        {
            "id": 15,
            "type": "debit",
            "order": 6,
            "name": "Inspecao - Zen Inspector",
            "description": "Inspecao de propriedades",
            "value": "$80",
            "frequency": "mensal",
            "active": False,
            "notes": "",
        },
        {
            "id": 16,
            "type": "debit",
            "order": 7,
            "name": "Rent Engine",
            "description": "Plataforma de listing",
            "value": "$45",
            "frequency": "por cadastro",
            "active": True,
            "notes": "",
        },
    ]


def _load_gross_expenses_store() -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not GROSS_EXPENSES_PATH.exists():
        items = _default_gross_expenses_items()
        store = {"next_id": 17, "items": items}
        GROSS_EXPENSES_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    try:
        raw = json.loads(GROSS_EXPENSES_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        items = _default_gross_expenses_items()
        store = {"next_id": 17, "items": items}
        GROSS_EXPENSES_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if not isinstance(raw, dict) or "items" not in raw:
        items = _default_gross_expenses_items()
        store = {"next_id": 17, "items": items}
        GROSS_EXPENSES_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if not raw.get("items"):
        raw["items"] = _default_gross_expenses_items()
    if raw.get("next_id") is None:
        mx = max((int(i.get("id") or 0) for i in raw["items"]), default=0)
        raw["next_id"] = mx + 1
    return raw


def _save_gross_expenses_store(store: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GROSS_EXPENSES_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _gross_expenses_public_item(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row["id"]),
        "type": row["type"],
        "order": int(row["order"]),
        "name": str(row.get("name") or ""),
        "description": str(row.get("description") or ""),
        "value": str(row.get("value") or ""),
        "frequency": str(row.get("frequency") or ""),
        "active": bool(row.get("active")),
        "notes": str(row.get("notes") or ""),
    }


@appfolio_bp.route("/gross-expenses", methods=["GET"])
def gross_expenses_list():
    store = _load_gross_expenses_store()
    items = [_gross_expenses_public_item(x) for x in store["items"]]
    items.sort(key=lambda x: (x["type"], x["order"], x["id"]))
    return jsonify({"items": items})


@appfolio_bp.route("/gross-expenses", methods=["POST"])
def gross_expenses_create():
    data = request.get_json(silent=True) or {}
    t = (data.get("type") or "").strip().lower()
    if t not in ("gross", "debit"):
        return jsonify({"error": "type must be gross or debit"}), 400
    store = _load_gross_expenses_store()
    same = [x for x in store["items"] if x["type"] == t]
    ord_next = max((int(x["order"]) for x in same), default=0) + 1
    if data.get("order") is not None:
        try:
            ord_next = int(data["order"])
        except (TypeError, ValueError):
            pass
    nid = int(store["next_id"])
    store["next_id"] = nid + 1
    row = {
        "id": nid,
        "type": t,
        "order": ord_next,
        "name": str(data.get("name") or "").strip(),
        "description": str(data.get("description") or "").strip(),
        "value": str(data.get("value") or "").strip(),
        "frequency": str(data.get("frequency") or "mensal").strip(),
        "active": bool(data.get("active", True)),
        "notes": str(data.get("notes") or "").strip(),
    }
    store["items"].append(row)
    _save_gross_expenses_store(store)
    return jsonify(_gross_expenses_public_item(row)), 201


@appfolio_bp.route("/gross-expenses/reorder", methods=["PUT"])
def gross_expenses_reorder():
    data = request.get_json(silent=True) or {}
    gross_ids = data.get("gross") or []
    debit_ids = data.get("debit") or []
    store = _load_gross_expenses_store()
    by_id = {int(x["id"]): x for x in store["items"]}
    for idx, iid in enumerate(gross_ids, start=1):
        try:
            iid = int(iid)
        except (TypeError, ValueError):
            continue
        if iid in by_id and by_id[iid]["type"] == "gross":
            by_id[iid]["order"] = idx
    for idx, iid in enumerate(debit_ids, start=1):
        try:
            iid = int(iid)
        except (TypeError, ValueError):
            continue
        if iid in by_id and by_id[iid]["type"] == "debit":
            by_id[iid]["order"] = idx
    store["items"] = list(by_id.values())
    _save_gross_expenses_store(store)
    return jsonify({"ok": True})


@appfolio_bp.route("/gross-expenses/<int:item_id>", methods=["PUT"])
def gross_expenses_update(item_id: int):
    data = request.get_json(silent=True) or {}
    store = _load_gross_expenses_store()
    for i, row in enumerate(store["items"]):
        if int(row["id"]) == item_id:
            if "type" in data:
                t = str(data.get("type") or "").lower()
                if t in ("gross", "debit"):
                    row["type"] = t
            if "order" in data:
                try:
                    row["order"] = int(data["order"])
                except (TypeError, ValueError):
                    pass
            if "name" in data:
                row["name"] = str(data.get("name") or "").strip()
            if "description" in data:
                row["description"] = str(data.get("description") or "").strip()
            if "value" in data:
                row["value"] = str(data.get("value") or "").strip()
            if "frequency" in data:
                row["frequency"] = str(data.get("frequency") or "").strip()
            if "active" in data:
                row["active"] = bool(data.get("active"))
            if "notes" in data:
                row["notes"] = str(data.get("notes") or "").strip()
            store["items"][i] = row
            _save_gross_expenses_store(store)
            return jsonify(_gross_expenses_public_item(row))
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/gross-expenses/<int:item_id>", methods=["DELETE"])
def gross_expenses_delete(item_id: int):
    store = _load_gross_expenses_store()
    new_items = [x for x in store["items"] if int(x["id"]) != item_id]
    if len(new_items) == len(store["items"]):
        return jsonify({"error": "not found"}), 404
    store["items"] = new_items
    _save_gross_expenses_store(store)
    return jsonify({"ok": True, "id": item_id})


# ---------------------------------------------------------------------------
# Org chart (HR)
# ---------------------------------------------------------------------------


def _default_org_chart_employees() -> List[Dict[str, Any]]:
    return [
        {
            "id": 1,
            "name": "Wellington Gomes",
            "title": "CEO / Founder",
            "department": "Executive",
            "photo_url": "",
            "email": "",
            "phone": "",
            "reports_to": None,
            "hire_date": "",
            "status": "active",
            "order": 1,
        },
        {
            "id": 2,
            "name": "Eddi Diamantino",
            "title": "Operations Manager",
            "department": "Operations",
            "photo_url": "",
            "email": "",
            "phone": "",
            "reports_to": 1,
            "hire_date": "",
            "status": "active",
            "order": 1,
        },
        {
            "id": 3,
            "name": "Samuel Santos",
            "title": "Property Manager",
            "department": "Operations",
            "photo_url": "",
            "email": "",
            "phone": "",
            "reports_to": 2,
            "hire_date": "",
            "status": "active",
            "order": 1,
        },
    ]


def _load_org_chart_store() -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not ORG_CHART_PATH.exists():
        em = _default_org_chart_employees()
        store = {"next_id": 4, "employees": em}
        ORG_CHART_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    try:
        raw = json.loads(ORG_CHART_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        em = _default_org_chart_employees()
        store = {"next_id": 4, "employees": em}
        ORG_CHART_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if not isinstance(raw, dict) or "employees" not in raw:
        em = _default_org_chart_employees()
        store = {"next_id": 4, "employees": em}
        ORG_CHART_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if not raw.get("employees"):
        raw["employees"] = _default_org_chart_employees()
    if raw.get("next_id") is None:
        mx = max((int(e.get("id") or 0) for e in raw["employees"]), default=0)
        raw["next_id"] = mx + 1
    return raw


def _save_org_chart_store(store: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ORG_CHART_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _org_norm_rt(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _org_employee_public(row: Dict[str, Any]) -> Dict[str, Any]:
    rt = _org_norm_rt(row.get("reports_to"))
    st = (row.get("status") or "active").strip().lower()
    if st not in ("active", "inactive"):
        st = "active"
    return {
        "id": int(row["id"]),
        "name": str(row.get("name") or ""),
        "title": str(row.get("title") or ""),
        "department": str(row.get("department") or ""),
        "photo_url": str(row.get("photo_url") or ""),
        "email": str(row.get("email") or ""),
        "phone": str(row.get("phone") or ""),
        "reports_to": rt,
        "hire_date": str(row.get("hire_date") or ""),
        "status": st,
        "order": int(row.get("order") or 0),
    }


@appfolio_bp.route("/org-chart", methods=["GET"])
def org_chart_list():
    store = _load_org_chart_store()
    out = [_org_employee_public(x) for x in store["employees"]]
    out.sort(key=lambda x: (x["department"], x["order"], x["name"]))
    return jsonify({"employees": out})


@appfolio_bp.route("/org-chart", methods=["POST"])
def org_chart_create():
    data = request.get_json(silent=True) or {}
    store = _load_org_chart_store()
    emps = store["employees"]
    new_rt = _org_norm_rt(data.get("reports_to"))
    same_boss = [x for x in emps if _org_norm_rt(x.get("reports_to")) == new_rt]
    ord_next = max((int(x.get("order") or 0) for x in same_boss), default=0) + 1
    if data.get("order") is not None:
        try:
            ord_next = int(data["order"])
        except (TypeError, ValueError):
            pass
    nid = int(store["next_id"])
    store["next_id"] = nid + 1
    rt = new_rt
    st = (data.get("status") or "active").strip().lower()
    if st not in ("active", "inactive"):
        st = "active"
    row = {
        "id": nid,
        "name": str(data.get("name") or "").strip(),
        "title": str(data.get("title") or "").strip(),
        "department": str(data.get("department") or "Operations").strip(),
        "photo_url": str(data.get("photo_url") or "").strip(),
        "email": str(data.get("email") or "").strip(),
        "phone": str(data.get("phone") or "").strip(),
        "reports_to": rt,
        "hire_date": str(data.get("hire_date") or "").strip(),
        "status": st,
        "order": ord_next,
    }
    if rt is not None and not any(int(x["id"]) == rt for x in emps):
        row["reports_to"] = None
    if int(row["id"]) == rt:
        row["reports_to"] = None
    emps.append(row)
    store["employees"] = emps
    _save_org_chart_store(store)
    return jsonify(_org_employee_public(row)), 201


@appfolio_bp.route("/org-chart/<int:emp_id>", methods=["PUT"])
def org_chart_update(emp_id: int):
    data = request.get_json(silent=True) or {}
    store = _load_org_chart_store()
    for i, row in enumerate(store["employees"]):
        if int(row["id"]) == emp_id:
            if "name" in data:
                row["name"] = str(data.get("name") or "").strip()
            if "title" in data:
                row["title"] = str(data.get("title") or "").strip()
            if "department" in data:
                row["department"] = str(data.get("department") or "").strip()
            if "photo_url" in data:
                row["photo_url"] = str(data.get("photo_url") or "").strip()
            if "email" in data:
                row["email"] = str(data.get("email") or "").strip()
            if "phone" in data:
                row["phone"] = str(data.get("phone") or "").strip()
            if "hire_date" in data:
                row["hire_date"] = str(data.get("hire_date") or "").strip()
            if "order" in data:
                try:
                    row["order"] = int(data["order"])
                except (TypeError, ValueError):
                    pass
            if "status" in data:
                st = str(data.get("status") or "active").lower()
                row["status"] = st if st in ("active", "inactive") else "active"
            if "reports_to" in data:
                rt = data.get("reports_to")
                if rt is not None and rt != "":
                    try:
                        rt = int(rt)
                    except (TypeError, ValueError):
                        rt = None
                else:
                    rt = None
                if rt == emp_id:
                    rt = None
                if rt is not None and not any(
                    int(x["id"]) == rt for x in store["employees"]
                ):
                    rt = None
                row["reports_to"] = rt
            store["employees"][i] = row
            _save_org_chart_store(store)
            return jsonify(_org_employee_public(row))
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/org-chart/<int:emp_id>", methods=["DELETE"])
def org_chart_delete(emp_id: int):
    store = _load_org_chart_store()
    target = None
    for x in store["employees"]:
        if int(x["id"]) == emp_id:
            target = x
            break
    if not target:
        return jsonify({"error": "not found"}), 404
    boss = target.get("reports_to")
    new_emps: List[Dict[str, Any]] = []
    for x in store["employees"]:
        if int(x["id"]) == emp_id:
            continue
        if int(x.get("reports_to") or 0) == emp_id:
            x["reports_to"] = boss
        new_emps.append(x)
    store["employees"] = new_emps
    _save_org_chart_store(store)
    return jsonify({"ok": True, "id": emp_id})


# ---------------------------------------------------------------------------
# Tenant registry (Premium — JSON store + filesystem documents)
# ---------------------------------------------------------------------------

_TENANT_FERNET: Optional[Fernet] = None

TENANT_DOC_TYPES = frozenset(
    {
        "boom_report",
        "id_front",
        "id_back",
        "pay_stub",
        "bank_statement",
        "lease_agreement",
        "other",
    }
)

TENANT_STATUSES = frozenset({"applicant", "approved", "active", "notice", "past"})
TENANT_TYPES = frozenset({"financially_responsible", "occupant", "guarantor"})
ACCOUNT_TYPES = frozenset({"checking", "savings"})
CREDIT_SOURCES = frozenset({"Boom", "Experian", "TransUnion", "Equifax", "Other"})
BG_STATUSES = frozenset({"pending", "approved", "denied", "conditional"})


def _fernet_tenant() -> Fernet:
    global _TENANT_FERNET
    if _TENANT_FERNET is not None:
        return _TENANT_FERNET
    raw_key = os.environ.get("GM_TENANT_FERNET_KEY")
    if raw_key:
        _TENANT_FERNET = Fernet(raw_key.strip().encode("ascii"))
        return _TENANT_FERNET
    salt = b"gm-tenant-kdf-v1"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390000,
    )
    secret = (os.environ.get("GM_TENANT_SECRET") or "godmanager-dev-tenant-secret").encode("utf-8")
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    _TENANT_FERNET = Fernet(key)
    return _TENANT_FERNET


def _tenant_encrypt(plain: str) -> str:
    s = (plain or "").strip()
    if not s:
        return ""
    tok = _fernet_tenant().encrypt(s.encode("utf-8"))
    return tok.decode("ascii")


def _tenant_decrypt(token: str) -> str:
    t = (token or "").strip()
    if not t:
        return ""
    try:
        return _fernet_tenant().decrypt(t.encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def _digits_only(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _mask_last4(plain: str) -> str:
    d = _digits_only(plain)
    if len(d) >= 4:
        return "****" + d[-4:]
    if d:
        return "****" + d
    return ""


def _is_masked_placeholder(val: Any) -> bool:
    s = str(val or "").strip()
    return s.startswith("****") and len(s) >= 6


def _finance_discount(asking: float, agreed: float) -> Tuple[float, float]:
    asking = float(asking or 0.0)
    agreed = float(agreed or 0.0)
    diff = asking - agreed
    if asking > 0.005:
        pct = round(100.0 * diff / asking, 2)
    else:
        pct = 0.0
    return round(diff, 2), pct


def _load_tenant_registry_store() -> Dict[str, Any]:
    TENANTS_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not TENANTS_REGISTRY_PATH.exists():
        store = {"next_tenant_id": 1, "next_doc_id": 1, "tenants": []}
        TENANTS_REGISTRY_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    try:
        raw = json.loads(TENANTS_REGISTRY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        store = {"next_tenant_id": 1, "next_doc_id": 1, "tenants": []}
        TENANTS_REGISTRY_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if not isinstance(raw, dict) or "tenants" not in raw:
        store = {"next_tenant_id": 1, "next_doc_id": 1, "tenants": []}
        TENANTS_REGISTRY_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return store
    if raw.get("next_tenant_id") is None:
        mx = max((int(t.get("id") or 0) for t in raw["tenants"]), default=0)
        raw["next_tenant_id"] = mx + 1
    if raw.get("next_doc_id") is None:
        mx_d = 0
        for t in raw["tenants"]:
            for d in t.get("documents") or []:
                mx_d = max(mx_d, int(d.get("id") or 0))
        raw["next_doc_id"] = mx_d + 1
    return raw


def _save_tenant_registry_store(store: Dict[str, Any]) -> None:
    TENANTS_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    TENANTS_REGISTRY_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _tenant_internal_defaults() -> Dict[str, Any]:
    return {
        "first_name": "",
        "last_name": "",
        "email": "",
        "phone": "",
        "phone_secondary": "",
        "date_of_birth": "",
        "ssn_last4_enc": "",
        "drivers_license": "",
        "emergency_contact_name": "",
        "emergency_contact_phone": "",
        "current_address": "",
        "employer_name": "",
        "employer_phone": "",
        "monthly_income": 0.0,
        "notes": "",
        "bank_name": "",
        "routing_number_enc": "",
        "account_number_enc": "",
        "account_type": "checking",
        "property_id": "",
        "property_address": "",
        "unit": "",
        "lease_start": "",
        "lease_end": "",
        "move_in_date": "",
        "asking_rent": 0.0,
        "agreed_rent": 0.0,
        "discount_amount": 0.0,
        "discount_percent": 0.0,
        "security_deposit": 0.0,
        "pet_deposit": 0.0,
        "pet_fee": 0.0,
        "monthly_pet_rent": 0.0,
        "credit_score": None,
        "credit_source": "",
        "credit_report_date": "",
        "background_check_status": "pending",
        "documents": [],
        "status": "applicant",
        "tenant_type": "financially_responsible",
    }


def _tenant_public(row: Dict[str, Any]) -> Dict[str, Any]:
    """API shape: masked sensitive fields, documents with download URL path."""
    tid = int(row["id"])
    ssn_plain = _tenant_decrypt(str(row.get("ssn_last4_enc") or ""))
    rt_plain = _tenant_decrypt(str(row.get("routing_number_enc") or ""))
    ac_plain = _tenant_decrypt(str(row.get("account_number_enc") or ""))
    docs_out: List[Dict[str, Any]] = []
    for d in row.get("documents") or []:
        did = int(d.get("id") or 0)
        docs_out.append(
            {
                "id": did,
                "filename": str(d.get("filename") or ""),
                "type": str(d.get("type") or "other"),
                "uploaded_at": str(d.get("uploaded_at") or ""),
                "url": f"/api/appfolio/tenants/{tid}/documents/{did}/file",
            }
        )
    disc_amt, disc_pct = _finance_discount(
        float(row.get("asking_rent") or 0.0), float(row.get("agreed_rent") or 0.0)
    )
    return {
        "id": tid,
        "created_at": str(row.get("created_at") or ""),
        "updated_at": str(row.get("updated_at") or ""),
        "first_name": str(row.get("first_name") or ""),
        "last_name": str(row.get("last_name") or ""),
        "email": str(row.get("email") or ""),
        "phone": str(row.get("phone") or ""),
        "phone_secondary": str(row.get("phone_secondary") or ""),
        "date_of_birth": str(row.get("date_of_birth") or ""),
        "ssn_last4": _mask_last4(ssn_plain) if ssn_plain else "",
        "drivers_license": str(row.get("drivers_license") or ""),
        "emergency_contact_name": str(row.get("emergency_contact_name") or ""),
        "emergency_contact_phone": str(row.get("emergency_contact_phone") or ""),
        "current_address": str(row.get("current_address") or ""),
        "employer_name": str(row.get("employer_name") or ""),
        "employer_phone": str(row.get("employer_phone") or ""),
        "monthly_income": float(row.get("monthly_income") or 0.0),
        "notes": str(row.get("notes") or ""),
        "bank_name": str(row.get("bank_name") or ""),
        "routing_number": _mask_last4(rt_plain) if rt_plain else "",
        "account_number": _mask_last4(ac_plain) if ac_plain else "",
        "account_type": str(row.get("account_type") or "checking"),
        "property_id": str(row.get("property_id") or ""),
        "property_address": str(row.get("property_address") or ""),
        "unit": str(row.get("unit") or ""),
        "lease_start": str(row.get("lease_start") or ""),
        "lease_end": str(row.get("lease_end") or ""),
        "move_in_date": str(row.get("move_in_date") or ""),
        "asking_rent": float(row.get("asking_rent") or 0.0),
        "agreed_rent": float(row.get("agreed_rent") or 0.0),
        "discount_amount": disc_amt,
        "discount_percent": disc_pct,
        "security_deposit": float(row.get("security_deposit") or 0.0),
        "pet_deposit": float(row.get("pet_deposit") or 0.0),
        "pet_fee": float(row.get("pet_fee") or 0.0),
        "monthly_pet_rent": float(row.get("monthly_pet_rent") or 0.0),
        "credit_score": row.get("credit_score"),
        "credit_source": str(row.get("credit_source") or ""),
        "credit_report_date": str(row.get("credit_report_date") or ""),
        "background_check_status": str(row.get("background_check_status") or "pending"),
        "documents": docs_out,
        "status": str(row.get("status") or "applicant"),
        "tenant_type": str(row.get("tenant_type") or "financially_responsible"),
    }


def _apply_tenant_payload(row: Dict[str, Any], data: Dict[str, Any], partial: bool) -> Optional[str]:
    """Mutates row (internal). Returns error message or None."""
    d = data or {}
    if not partial:
        for k in ("first_name", "last_name", "email"):
            if not str(d.get(k) or "").strip():
                return f"missing {k}"

    def _sf(key: str, dest_key: Optional[str] = None) -> None:
        dk = dest_key or key
        if key in d:
            row[dk] = str(d.get(key) or "").strip()

    for key in (
        "first_name",
        "last_name",
        "email",
        "phone",
        "phone_secondary",
        "date_of_birth",
        "drivers_license",
        "emergency_contact_name",
        "emergency_contact_phone",
        "current_address",
        "employer_name",
        "employer_phone",
        "notes",
        "bank_name",
        "property_id",
        "property_address",
        "unit",
        "lease_start",
        "lease_end",
        "move_in_date",
        "credit_source",
        "credit_report_date",
    ):
        if key in d:
            _sf(key)

    if "ssn_last4" in d:
        v = str(d.get("ssn_last4") or "").strip()
        if not v:
            row["ssn_last4_enc"] = ""
        elif not _is_masked_placeholder(v):
            d4 = _digits_only(v)[:4]
            row["ssn_last4_enc"] = _tenant_encrypt(d4) if d4 else ""

    if "routing_number" in d:
        v = str(d.get("routing_number") or "").strip()
        if not v:
            row["routing_number_enc"] = ""
        elif not _is_masked_placeholder(v):
            r9 = _digits_only(v)[:9]
            row["routing_number_enc"] = _tenant_encrypt(r9) if r9 else ""

    if "account_number" in d:
        v = str(d.get("account_number") or "").strip()
        if not v:
            row["account_number_enc"] = ""
        elif not _is_masked_placeholder(v):
            ac = _digits_only(v)
            row["account_number_enc"] = _tenant_encrypt(ac) if ac else ""

    if "account_type" in d:
        at = str(d.get("account_type") or "").strip().lower()
        row["account_type"] = at if at in ACCOUNT_TYPES else "checking"

    if "tenant_type" in d:
        tt = str(d.get("tenant_type") or "").strip().lower()
        row["tenant_type"] = tt if tt in TENANT_TYPES else "financially_responsible"

    if "status" in d:
        st = str(d.get("status") or "").strip().lower()
        row["status"] = st if st in TENANT_STATUSES else "applicant"

    if "background_check_status" in d:
        bg = str(d.get("background_check_status") or "").strip().lower()
        row["background_check_status"] = bg if bg in BG_STATUSES else "pending"

    if "credit_source" in d:
        cs = str(d.get("credit_source") or "").strip()
        row["credit_source"] = cs if cs in CREDIT_SOURCES else "Other"

    if "credit_score" in d:
        csq = d.get("credit_score")
        if csq is None or csq == "":
            row["credit_score"] = None
        else:
            try:
                row["credit_score"] = int(csq)
            except (TypeError, ValueError):
                row["credit_score"] = None

    num_keys = (
        "monthly_income",
        "asking_rent",
        "agreed_rent",
        "security_deposit",
        "pet_deposit",
        "pet_fee",
        "monthly_pet_rent",
    )
    for nk in num_keys:
        if nk in d:
            try:
                row[nk] = float(d.get(nk) or 0.0)
            except (TypeError, ValueError):
                row[nk] = 0.0

    da, dp = _finance_discount(float(row.get("asking_rent") or 0.0), float(row.get("agreed_rent") or 0.0))
    row["discount_amount"] = da
    row["discount_percent"] = dp

    if not partial:
        if not str(row.get("lease_start") or "").strip():
            return "missing lease_start"
        if not str(row.get("lease_end") or "").strip():
            return "missing lease_end"
        if not str(row.get("property_id") or "").strip():
            return "missing property_id"
        try:
            if float(row.get("agreed_rent") or 0.0) <= 0.0:
                return "agreed_rent required"
        except (TypeError, ValueError):
            return "agreed_rent required"

    return None


@appfolio_bp.route("/tenants/register", methods=["POST"])
def tenant_registry_register():
    data = request.get_json(silent=True) or {}
    store = _load_tenant_registry_store()
    nid = int(store["next_tenant_id"])
    store["next_tenant_id"] = nid + 1
    now = _iso_now()
    row: Dict[str, Any] = {"id": nid, "created_at": now, "updated_at": now}
    row.update(_tenant_internal_defaults())
    err = _apply_tenant_payload(row, data, partial=False)
    if err:
        store["next_tenant_id"] = nid
        return jsonify({"error": err}), 400
    store["tenants"].append(row)
    _save_tenant_registry_store(store)
    return jsonify(_tenant_public(row)), 201


@appfolio_bp.route("/tenants/list", methods=["GET"])
def tenant_registry_list():
    store = _load_tenant_registry_store()
    status_q = (request.args.get("status") or "").strip().lower()
    prop_q = (request.args.get("property_id") or "").strip()
    search_q = (request.args.get("search") or "").strip().lower()
    items = [_tenant_public(t) for t in store["tenants"]]
    filtered: List[Dict[str, Any]] = []
    for it in items:
        if status_q and (it.get("status") or "").lower() != status_q:
            continue
        if prop_q and str(it.get("property_id") or "") != prop_q:
            continue
        blob = f"{it.get('first_name','')} {it.get('last_name','')} {it.get('email','')}".lower()
        if search_q and search_q not in blob:
            continue
        filtered.append(it)
    filtered.sort(key=lambda x: (-int(x["id"])))
    pg = _paginate(filtered)
    pg["tenants"] = pg.pop("items")
    return jsonify(pg)


@appfolio_bp.route("/tenants/discount-report", methods=["GET"])
def tenant_registry_discount_report():
    store = _load_tenant_registry_store()
    prop_q = (request.args.get("property_id") or "").strip()
    range_q = (request.args.get("discount_range") or "").strip()
    rows: List[Dict[str, Any]] = []
    for t in store["tenants"]:
        pub = _tenant_public(t)
        if float(pub.get("discount_amount") or 0.0) <= 0.005:
            continue
        if prop_q and str(pub.get("property_id") or "") != prop_q:
            continue
        pct = float(pub.get("discount_percent") or 0.0)
        if range_q == "0-5":
            if not (0 <= pct < 5):
                continue
        elif range_q == "5-10":
            if not (5 <= pct < 10):
                continue
        elif range_q == "10+":
            if pct < 10:
                continue
        rows.append(pub)
    rows.sort(key=lambda x: -float(x.get("discount_amount") or 0.0))
    with_discount = len(rows)
    total_monthly = sum(float(x.get("discount_amount") or 0.0) for x in rows)
    pcts = [float(x.get("discount_percent") or 0.0) for x in rows if float(x.get("asking_rent") or 0) > 0.005]
    avg_pct = round(sum(pcts) / len(pcts), 2) if pcts else 0.0
    annual = round(total_monthly * 12.0, 2)
    return jsonify(
        {
            "summary": {
                "total_tenants_with_discount": with_discount,
                "total_monthly_discount": round(total_monthly, 2),
                "average_discount_percent": avg_pct,
                "annual_impact": annual,
            },
            "rows": rows,
        }
    )


@appfolio_bp.route("/tenants/<int:tenant_id>", methods=["GET"])
def tenant_registry_get(tenant_id: int):
    store = _load_tenant_registry_store()
    for t in store["tenants"]:
        if int(t["id"]) == tenant_id:
            return jsonify(_tenant_public(t))
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/tenants/<int:tenant_id>", methods=["PUT"])
def tenant_registry_put(tenant_id: int):
    data = request.get_json(silent=True) or {}
    store = _load_tenant_registry_store()
    for i, t in enumerate(store["tenants"]):
        if int(t["id"]) == tenant_id:
            err = _apply_tenant_payload(t, data, partial=True)
            if err:
                return jsonify({"error": err}), 400
            t["updated_at"] = _iso_now()
            store["tenants"][i] = t
            _save_tenant_registry_store(store)
            return jsonify(_tenant_public(t))
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/tenants/<int:tenant_id>", methods=["DELETE"])
def tenant_registry_delete(tenant_id: int):
    store = _load_tenant_registry_store()
    new_list: List[Dict[str, Any]] = []
    removed: Optional[Dict[str, Any]] = None
    for t in store["tenants"]:
        if int(t["id"]) == tenant_id:
            removed = t
            continue
        new_list.append(t)
    if removed is None:
        return jsonify({"error": "not found"}), 404
    for d in removed.get("documents") or []:
        rel = str(d.get("stored_relpath") or "")
        if rel:
            p = TENANT_DOCS_DIR / rel
            try:
                if p.is_file():
                    p.unlink()
            except OSError:
                pass
    store["tenants"] = new_list
    _save_tenant_registry_store(store)
    return jsonify({"ok": True, "id": tenant_id})


@appfolio_bp.route("/tenants/<int:tenant_id>/documents", methods=["GET"])
def tenant_registry_docs_list(tenant_id: int):
    store = _load_tenant_registry_store()
    for t in store["tenants"]:
        if int(t["id"]) == tenant_id:
            return jsonify({"documents": _tenant_public(t)["documents"]})
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/tenants/<int:tenant_id>/documents", methods=["POST"])
def tenant_registry_docs_upload(tenant_id: int):
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"error": "empty file"}), 400
    doc_type = (request.form.get("type") or "other").strip()
    if doc_type not in TENANT_DOC_TYPES:
        doc_type = "other"
    store = _load_tenant_registry_store()
    target: Optional[Dict[str, Any]] = None
    for t in store["tenants"]:
        if int(t["id"]) == tenant_id:
            target = t
            break
    if not target:
        return jsonify({"error": "not found"}), 404
    did = int(store["next_doc_id"])
    store["next_doc_id"] = did + 1
    safe_fn = secure_filename(f.filename) or "upload"
    subdir = Path(str(tenant_id))
    TENANT_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    (TENANT_DOCS_DIR / subdir).mkdir(parents=True, exist_ok=True)
    rel = str(subdir / f"{did}_{safe_fn}")
    dest = TENANT_DOCS_DIR / rel
    f.save(str(dest))
    entry = {
        "id": did,
        "filename": safe_fn,
        "type": doc_type,
        "uploaded_at": _iso_now(),
        "stored_relpath": rel,
    }
    if "documents" not in target or not isinstance(target["documents"], list):
        target["documents"] = []
    target["documents"].append(entry)
    target["updated_at"] = _iso_now()
    _save_tenant_registry_store(store)
    pub = _tenant_public(target)
    doc_pub = next((x for x in pub["documents"] if int(x["id"]) == did), None)
    return jsonify(doc_pub or entry), 201


@appfolio_bp.route("/tenants/<int:tenant_id>/documents/<int:doc_id>", methods=["DELETE"])
def tenant_registry_doc_delete(tenant_id: int, doc_id: int):
    store = _load_tenant_registry_store()
    for ti, t in enumerate(store["tenants"]):
        if int(t["id"]) != tenant_id:
            continue
        docs = list(t.get("documents") or [])
        new_docs: List[Dict[str, Any]] = []
        hit = False
        for d in docs:
            if int(d.get("id") or 0) == doc_id:
                hit = True
                rel = str(d.get("stored_relpath") or "")
                if rel:
                    p = TENANT_DOCS_DIR / rel
                    try:
                        if p.is_file():
                            p.unlink()
                    except OSError:
                        pass
                continue
            new_docs.append(d)
        if not hit:
            return jsonify({"error": "not found"}), 404
        t["documents"] = new_docs
        t["updated_at"] = _iso_now()
        store["tenants"][ti] = t
        _save_tenant_registry_store(store)
        return jsonify({"ok": True, "id": doc_id})
    return jsonify({"error": "not found"}), 404


@appfolio_bp.route("/tenants/<int:tenant_id>/documents/<int:doc_id>/file", methods=["GET"])
def tenant_registry_doc_file(tenant_id: int, doc_id: int):
    store = _load_tenant_registry_store()
    for t in store["tenants"]:
        if int(t["id"]) != tenant_id:
            continue
        for d in t.get("documents") or []:
            if int(d.get("id") or 0) != doc_id:
                continue
            rel = str(d.get("stored_relpath") or "")
            if not rel:
                return jsonify({"error": "missing file"}), 404
            p = TENANT_DOCS_DIR / rel
            if not p.is_file():
                return jsonify({"error": "file missing"}), 404
            return send_file(
                str(p),
                as_attachment=True,
                download_name=str(d.get("filename") or p.name),
            )
    return jsonify({"error": "not found"}), 404


# ---------------------------------------------------------------------------
# Long Term — expense approval + audit logs (JSON files in website/data/)
# ---------------------------------------------------------------------------


def _load_approval_logs() -> List[Dict[str, Any]]:
    APPROVAL_LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not APPROVAL_LOGS_PATH.exists():
        APPROVAL_LOGS_PATH.write_text("[]", encoding="utf-8")
        return []
    try:
        raw = json.loads(APPROVAL_LOGS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return raw if isinstance(raw, list) else []


def _save_approval_logs(logs: List[Dict[str, Any]]) -> None:
    APPROVAL_LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    APPROVAL_LOGS_PATH.write_text(json.dumps(logs, indent=2), encoding="utf-8")


def _load_lt_exp_approval_state() -> Dict[str, int]:
    LT_EXP_APPROVAL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not LT_EXP_APPROVAL_STATE_PATH.exists():
        LT_EXP_APPROVAL_STATE_PATH.write_text("{}", encoding="utf-8")
        return {}
    try:
        raw = json.loads(LT_EXP_APPROVAL_STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, int] = {}
    for k, v in raw.items():
        try:
            out[str(k)] = max(0, min(3, int(v)))
        except (TypeError, ValueError):
            continue
    return out


def _save_lt_exp_approval_state(state: Dict[str, int]) -> None:
    LT_EXP_APPROVAL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    LT_EXP_APPROVAL_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _append_expense_audit_log(
    *,
    expense_id: str,
    action: str,
    step_name: str,
    performed_by: str,
    ip_address: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    logs = _load_approval_logs()
    nid = max((int(x.get("id") or 0) for x in logs), default=0) + 1
    entry: Dict[str, Any] = {
        "id": nid,
        "expense_id": expense_id,
        "action": action,
        "step_name": step_name,
        "performed_by": (performed_by or "Unknown")[:200],
        "performed_at": _iso_now() + "Z",
    }
    if ip_address:
        entry["ip_address"] = str(ip_address)[:80]
    if notes:
        entry["notes"] = str(notes)[:500]
    logs.append(entry)
    _save_approval_logs(logs)
    return entry


@appfolio_bp.route("/expenses/<path:expense_id>/approve", methods=["PUT"])
def lt_expense_approve(expense_id: str):
    expense_id = str(expense_id).strip() or "unknown"
    body = request.get_json(silent=True) or {}
    try:
        step = int(body.get("step"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "step required (1, 2, or 3)"}), 400
    if step not in (1, 2, 3):
        return jsonify({"ok": False, "error": "invalid step"}), 400

    state = _load_lt_exp_approval_state()
    if expense_id in state:
        cur = max(0, min(3, int(state.get(expense_id) or 0)))
    else:
        ic_raw = body.get("if_current")
        if ic_raw is None:
            ic_raw = body.get("ifCurrent")
        if ic_raw is not None:
            try:
                cur = max(0, min(3, int(ic_raw)))
            except (TypeError, ValueError):
                cur = 0
        else:
            cur = 0

    if step != cur + 1:
        return jsonify({"ok": False, "error": "out of sequence", "approval_step": cur}), 409

    state[expense_id] = step
    _save_lt_exp_approval_state(state)
    performed_by = str(body.get("performed_by") or request.headers.get("X-GM-User") or "Unknown").strip()
    log = _append_expense_audit_log(
        expense_id=expense_id,
        action=f"approve_step_{step}",
        step_name=_LT_EXP_STEP_NAMES.get(step, str(step)),
        performed_by=performed_by,
        ip_address=request.remote_addr,
        notes=body.get("notes"),
    )
    return jsonify({"ok": True, "expense_id": expense_id, "approval_step": step, "log": log})


@appfolio_bp.route("/expenses/<path:expense_id>/unapprove", methods=["PUT"])
def lt_expense_unapprove(expense_id: str):
    expense_id = str(expense_id).strip() or "unknown"
    body = request.get_json(silent=True) or {}
    try:
        step = int(body.get("step"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "step required (1, 2, or 3)"}), 400
    if step not in (1, 2, 3):
        return jsonify({"ok": False, "error": "invalid step"}), 400

    state = _load_lt_exp_approval_state()
    if expense_id in state:
        cur = max(0, min(3, int(state.get(expense_id) or 0)))
    else:
        ic_raw = body.get("if_current")
        if ic_raw is None:
            ic_raw = body.get("ifCurrent")
        if ic_raw is not None:
            try:
                cur = max(0, min(3, int(ic_raw)))
            except (TypeError, ValueError):
                cur = 0
        else:
            cur = 0

    if cur < step:
        return jsonify({"ok": False, "error": "cannot unapprove incomplete step", "approval_step": cur}), 409

    new_s = step - 1
    state[expense_id] = new_s
    _save_lt_exp_approval_state(state)
    performed_by = str(body.get("performed_by") or request.headers.get("X-GM-User") or "Unknown").strip()
    log = _append_expense_audit_log(
        expense_id=expense_id,
        action=f"unapprove_step_{step}",
        step_name=_LT_EXP_STEP_NAMES.get(step, str(step)),
        performed_by=performed_by,
        ip_address=request.remote_addr,
        notes=body.get("notes"),
    )
    return jsonify({"ok": True, "expense_id": expense_id, "approval_step": new_s, "log": log})


@appfolio_bp.route("/expenses/<path:expense_id>/logs", methods=["GET"])
def lt_expense_logs(expense_id: str):
    expense_id = str(expense_id).strip() or "unknown"
    logs = _load_approval_logs()
    rows = [x for x in logs if str(x.get("expense_id") or "") == expense_id]
    rows.sort(key=lambda x: str(x.get("performed_at") or ""))
    return jsonify({"logs": rows})


@appfolio_bp.route("/expenses/<path:expense_id>/approval", methods=["GET"])
def lt_expense_approval_get(expense_id: str):
    """Optional: read server-side approval_step for an expense id."""
    expense_id = str(expense_id).strip() or "unknown"
    state = _load_lt_exp_approval_state()
    return jsonify({"expense_id": expense_id, "approval_step": int(state.get(expense_id, 0) or 0)})


# External owner/tenant forms (public HTML + JSON API)
from external_forms import register_external_form_routes

register_external_form_routes(appfolio_bp)

from vendor_registry import register_vendor_routes

register_vendor_routes(appfolio_bp)
