"""Ramp API proxy routes for GodManager."""
from __future__ import annotations

import os
import threading
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

ramp_bp = Blueprint("ramp", __name__, url_prefix="/api/ramp")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ramp")

_TOKEN_LOCK = threading.Lock()
_TOKEN_CACHE: Dict[str, Any] = {"value": None, "expires_at": None}
_DEFAULT_TIMEOUT = 25
_RAMP_LAST_DEBUG: Dict[str, Any] = {}


def _ramp_base_url() -> str:
    return os.getenv("RAMP_API_BASE_URL", "https://api.ramp.com/developer/v1").rstrip("/")


def _ramp_creds() -> Tuple[str, str]:
    return (os.getenv("RAMP_CLIENT_ID", "").strip(), os.getenv("RAMP_CLIENT_SECRET", "").strip())


def _ramp_scope() -> str:
    # Ramp client_credentials requires scope; allow override via env.
    return os.getenv(
        "RAMP_SCOPE",
        "transactions:read cards:read users:read departments:read vendors:read statements:read reimbursements:read",
    ).strip() or "read"


def _masked_info(name: str) -> Dict[str, Any]:
    val = os.getenv(name, "")
    has = bool(val)
    v = val.strip()
    digest = hashlib.sha256(v.encode("utf-8")).hexdigest()[:12] if v else ""
    return {
        "name": name,
        "present": has,
        "length": len(v),
        "prefix": v[:8] if v else "",
        "suffix": v[-6:] if v else "",
        "sha256_12": digest,
    }


def _token_is_valid() -> bool:
    value = _TOKEN_CACHE.get("value")
    expires_at = _TOKEN_CACHE.get("expires_at")
    if not value or not isinstance(expires_at, datetime):
        return False
    return datetime.now(timezone.utc) < expires_at


def _fetch_token() -> Tuple[Optional[str], Optional[str]]:
    client_id, client_secret = _ramp_creds()
    if not client_id or not client_secret:
        return None, "RAMP_CLIENT_ID/RAMP_CLIENT_SECRET não configurados."

    with _TOKEN_LOCK:
        if _token_is_valid():
            return str(_TOKEN_CACHE["value"]), None

        url = f"{_ramp_base_url()}/token"
        payload = {"grant_type": "client_credentials", "scope": _ramp_scope()}

        attempts: List[Tuple[str, Dict[str, str], Dict[str, str], Optional[Tuple[str, str]]]] = [
            # Attempt 1: OAuth basic auth + grant_type
            (
                "basic_auth",
                payload,
                {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
                (client_id, client_secret),
            ),
            # Attempt 2: Credentials in request form (some providers expect this form)
            (
                "form_credentials",
                {
                    "grant_type": "client_credentials",
                    "scope": _ramp_scope(),
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
                None,
            ),
        ]

        resp = None
        last_error = ""
        for mode, data, headers, auth in attempts:
            try:
                resp = requests.post(url, data=data, headers=headers, auth=auth, timeout=_DEFAULT_TIMEOUT)
            except requests.RequestException as exc:
                last_error = f"{mode}: {exc}"
                continue

            if resp.ok:
                break
            snippet = (resp.text or "")[:220]
            last_error = f"{mode} HTTP {resp.status_code}: {snippet}"

        if resp is None:
            return None, f"Falha de rede ao obter token Ramp: {last_error}"
        if not resp.ok:
            cid_len = len(client_id or "")
            sec_len = len(client_secret or "")
            return None, (
                "Ramp token falhou após tentativas OAuth. "
                f"client_id_len={cid_len}, client_secret_len={sec_len}. "
                f"Detalhe: {last_error}"
            )

        body = resp.json() if resp.content else {}
        token = body.get("access_token")
        if not token:
            return None, "Ramp token sem access_token na resposta."

        # Ramp tokens typically live up to 10 days; we also respect expires_in if present.
        expires_in = int(body.get("expires_in") or 0)
        if expires_in > 0:
            ttl = max(60, expires_in - 120)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        else:
            expires_at = datetime.now(timezone.utc) + timedelta(days=10) - timedelta(minutes=10)

        _TOKEN_CACHE["value"] = token
        _TOKEN_CACHE["expires_at"] = expires_at
        return token, None


def _ramp_get(path: str, params: Optional[Dict[str, Any]] = None) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
    token, token_err = _fetch_token()
    if token_err:
        return None, token_err, 503

    url = f"{_ramp_base_url()}/{path.lstrip('/')}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    logger.info("Ramp API call: %s", url)
    logger.info("Ramp API params: %s", params or {})
    try:
        resp = requests.get(url, headers=headers, params=params or {}, timeout=_DEFAULT_TIMEOUT)
    except requests.RequestException as exc:
        return None, f"Erro de rede na API Ramp: {exc}", 502
    body_text = resp.text or ""
    logger.info("Ramp API status: %s", resp.status_code)
    logger.info("Ramp API body size: %s", len(body_text))
    logger.info("Ramp API body preview: %s", body_text[:500])
    if not body_text.strip():
        logger.info("EMPTY RESPONSE")
    _RAMP_LAST_DEBUG["last_call"] = {
        "url": resp.url,
        "path": path,
        "params": params or {},
        "status": resp.status_code,
        "body_size": len(body_text),
        "body_preview": body_text[:500],
    }

    if not resp.ok:
        snippet = body_text[:300]
        return None, f"Ramp retornou HTTP {resp.status_code}: {snippet}", resp.status_code

    return (resp.json() if resp.content else {}), None, 200


def _default_date_range() -> Tuple[str, str]:
    now = datetime.now(timezone.utc)
    frm = now - timedelta(days=90)
    return frm.isoformat(), now.isoformat()


def _collect_transactions(params: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
    all_rows: List[Dict[str, Any]] = []
    page_params = dict(params)
    max_pages = int(request.args.get("max_pages") or 25)
    pages = 0
    while pages < max_pages:
        payload, err, code = _ramp_get("transactions", page_params)
        if err:
            return [], err, code
        rows = _extract_list(payload)
        logger.info("Ramp transactions page %s count: %s", pages + 1, len(rows))
        all_rows.extend(rows)
        pages += 1
        next_cursor = None
        if isinstance(payload, dict):
            page_info = payload.get("page") if isinstance(payload.get("page"), dict) else {}
            next_cursor = page_info.get("next") or payload.get("next_start") or payload.get("next")
        if not next_cursor:
            break
        page_params["start"] = str(next_cursor)
    return all_rows, None, 200


def _extract_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []
    if isinstance(payload.get("data"), list):
        return [x for x in payload["data"] if isinstance(x, dict)]
    if isinstance(payload.get("transactions"), list):
        return [x for x in payload["transactions"] if isinstance(x, dict)]
    if isinstance(payload.get("cards"), list):
        return [x for x in payload["cards"] if isinstance(x, dict)]
    return []


def _tx_amount(tx: Dict[str, Any]) -> float:
    amt = tx.get("amount")
    if isinstance(amt, (int, float)):
        return float(amt) / 100.0
    if isinstance(amt, dict):
        raw = amt.get("amount", amt.get("value", 0))
        try:
            return float(raw) / 100.0
        except (TypeError, ValueError):
            return 0.0
    return 0.0


def _tx_date(tx: Dict[str, Any]) -> str:
    raw = tx.get("user_transaction_time") or tx.get("occurred_at") or tx.get("posted_at") or ""
    return str(raw)[:10]


def _tx_month(tx: Dict[str, Any]) -> str:
    dt = _tx_date(tx)
    return dt[:7] if len(dt) >= 7 else "unknown"


def _tx_merchant(tx: Dict[str, Any]) -> str:
    merchant = tx.get("merchant_name") or ((tx.get("merchant") or {}).get("name")) or "Unknown"
    return str(merchant)


def _tx_category(tx: Dict[str, Any]) -> str:
    category = tx.get("sk_category_name") or ((tx.get("category") or {}).get("name")) or tx.get("accounting_category") or "Uncategorized"
    return str(category)


def _tx_holder(tx: Dict[str, Any]) -> str:
    user = tx.get("user") or {}
    if isinstance(user, dict):
        full = " ".join(x for x in [str(user.get("first_name") or "").strip(), str(user.get("last_name") or "").strip()] if x).strip()
        if full:
            return full
        if user.get("email"):
            return str(user["email"])
    return str(tx.get("card_holder_name") or ((tx.get("cardholder") or {}).get("display_name")) or "Unknown")


def _tx_receipt_status(tx: Dict[str, Any]) -> str:
    receipt_missing = tx.get("receipt_missing")
    receipt_url = tx.get("receipt_url")
    if receipt_missing is True:
        return "Missing"
    if receipt_url:
        return "Uploaded"
    rec = tx.get("receipt")
    if isinstance(rec, dict) and rec:
        return "Uploaded"
    return "Missing"


@ramp_bp.get("/status")
def ramp_status():
    token, err = _fetch_token()
    return jsonify({"connected": bool(token and not err), "error": err})


@ramp_bp.get("/diag-env")
def ramp_diag_env():
    """Safe diagnostic for runtime env (no raw secrets)."""
    return jsonify(
        {
            "service_time_utc": datetime.now(timezone.utc).isoformat(),
            "vars": {
                "RAMP_CLIENT_ID": _masked_info("RAMP_CLIENT_ID"),
                "RAMP_CLIENT_SECRET": _masked_info("RAMP_CLIENT_SECRET"),
                "RAMP_API_BASE_URL": _masked_info("RAMP_API_BASE_URL"),
                "RAMP_SCOPE": _masked_info("RAMP_SCOPE"),
            },
        }
    )


@ramp_bp.get("/transactions")
def ramp_transactions():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "start", "page_size", "user_id", "merchant"):
        val = request.args.get(q)
        if val:
            params[q] = val
    if "from_date" not in params or "to_date" not in params:
        dfrom, dto = _default_date_range()
        params.setdefault("from_date", dfrom)
        params.setdefault("to_date", dto)
    params.setdefault("page_size", request.args.get("page_size", "500"))

    rows, err, code = _collect_transactions(params)
    if err:
        return jsonify({"error": err, "transactions": []}), code
    logger.info("Ramp transactions total count: %s", len(rows))

    txs = [
        {
            "id": tx.get("id"),
            "amount": _tx_amount(tx),
            "merchant_name": _tx_merchant(tx),
            "category": _tx_category(tx),
            "card_holder": _tx_holder(tx),
            "user_id": (tx.get("user") or {}).get("id") if isinstance(tx.get("user"), dict) else tx.get("user_id"),
            "card_last4": str((tx.get("card") or {}).get("last_four") or tx.get("card_last_four") or ""),
            "card_id": str((tx.get("card") or {}).get("id") or tx.get("card_id") or ""),
            "date": _tx_date(tx),
            "receipt_status": _tx_receipt_status(tx),
            "status": str(tx.get("state") or tx.get("status") or "PENDING").upper(),
            "raw": tx,
        }
        for tx in rows
    ]
    return jsonify(
        {
            "transactions": txs,
            "count": len(txs),
            "raw_preview": str(rows[:2])[:500],
            "filters": {"from_date": params.get("from_date"), "to_date": params.get("to_date"), "user_id": params.get("user_id"), "merchant": params.get("merchant")},
        }
    )


def _build_summary_response(params: Dict[str, Any]):
    rows, err, code = _collect_transactions(params)
    if err:
        return jsonify({"error": err, "summary": {}}), code

    by_merchant: Dict[str, Dict[str, Any]] = {}
    by_category: Dict[str, float] = {}
    by_user: Dict[str, Dict[str, Any]] = {}
    by_month: Dict[str, float] = {}
    total_spent = 0.0

    for tx in rows:
        amount = abs(_tx_amount(tx))
        total_spent += amount
        merchant = _tx_merchant(tx)
        category = _tx_category(tx)
        holder = _tx_holder(tx)
        month = _tx_month(tx)
        if merchant not in by_merchant:
            by_merchant[merchant] = {"name": merchant, "total": 0.0, "count": 0}
        by_merchant[merchant]["total"] += amount
        by_merchant[merchant]["count"] += 1
        by_category[category] = by_category.get(category, 0.0) + amount
        if holder not in by_user:
            by_user[holder] = {"name": holder, "total": 0.0, "count": 0}
        by_user[holder]["total"] += amount
        by_user[holder]["count"] += 1
        by_month[month] = by_month.get(month, 0.0) + amount

    by_cat_arr = [{"name": k, "total": v} for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)]
    by_mon_arr = [{"month": k, "total": v} for k, v in sorted(by_month.items(), key=lambda x: x[0])]
    by_user_arr = sorted(by_user.values(), key=lambda x: x["total"], reverse=True)
    by_mer_arr = sorted(by_merchant.values(), key=lambda x: x["total"], reverse=True)

    return jsonify(
        {
            "summary": {
                "total_spent": total_spent,
                "transaction_count": len(rows),
                "count": len(rows),
                "by_user": by_user_arr,
                "by_merchant": by_mer_arr,
                "by_category": by_cat_arr,
                "by_month": by_mon_arr,
            }
        }
    ), 200


@ramp_bp.get("/transactions/summary")
def ramp_transactions_summary():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "start", "page_size", "user_id", "merchant"):
        val = request.args.get(q)
        if val:
            params[q] = val
    if "from_date" not in params or "to_date" not in params:
        dfrom, dto = _default_date_range()
        params.setdefault("from_date", dfrom)
        params.setdefault("to_date", dto)
    params.setdefault("page_size", request.args.get("page_size", "500"))
    return _build_summary_response(params)


@ramp_bp.get("/summary")
def ramp_summary():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "start", "page_size", "user_id", "merchant"):
        val = request.args.get(q)
        if val:
            params[q] = val
    if "from_date" not in params or "to_date" not in params:
        dfrom, dto = _default_date_range()
        params.setdefault("from_date", dfrom)
        params.setdefault("to_date", dto)
    params.setdefault("page_size", request.args.get("page_size", "500"))
    return _build_summary_response(params)


@ramp_bp.get("/debug-data")
def ramp_debug_data():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "user_id", "merchant"):
        val = request.args.get(q)
        if val:
            params[q] = val
    if "from_date" not in params or "to_date" not in params:
        dfrom, dto = _default_date_range()
        params.setdefault("from_date", dfrom)
        params.setdefault("to_date", dto)
    params.setdefault("page_size", "500")

    token, token_err = _fetch_token()
    tx_rows, tx_err, tx_code = _collect_transactions(params) if token and not token_err else ([], token_err or "token_error", 503)
    cards_payload, cards_err, _ = _ramp_get("cards", {"page_size": "100"}) if token and not token_err else ({}, "token_error", 503)
    users_payload, users_err, _ = _ramp_get("users", {"page_size": "100"}) if token and not token_err else ({}, "token_error", 503)

    last = _RAMP_LAST_DEBUG.get("last_call", {})
    return jsonify(
        {
            "token_status": "valid" if token and not token_err else "invalid",
            "token_error": token_err,
            "token_scopes": _ramp_scope(),
            "transactions_url": last.get("url"),
            "transactions_status": tx_code,
            "transactions_count": len(tx_rows),
            "transactions_raw_preview": str(tx_rows[:2])[:300],
            "cards_count": len(_extract_list(cards_payload)) if not cards_err else 0,
            "users_count": len(_extract_list(users_payload)) if not users_err else 0,
            "last_debug": last,
        }
    )


@ramp_bp.get("/cards")
def ramp_cards():
    payload, err, code = _ramp_get("cards", {"page_size": request.args.get("page_size", "300")})
    if err:
        return jsonify({"error": err, "cards": []}), code
    cards = _extract_list(payload)
    data = []
    for c in cards:
        user = c.get("user") or c.get("cardholder") or {}
        holder = " ".join([str(user.get("first_name") or "").strip(), str(user.get("last_name") or "").strip()]).strip() or str(user.get("email") or "")
        data.append(
            {
                "card_id": c.get("id"),
                "display_name": c.get("display_name") or c.get("cardholder_name"),
                "holder": holder or "Unknown",
                "state": str(c.get("state") or c.get("status") or "").upper(),
                "type": str(c.get("card_type") or c.get("type") or ""),
                "spending_restrictions": c.get("spending_restrictions") or {},
                "last_four": str(c.get("last_four") or ""),
                "spend_limit": c.get("spending_limit") or c.get("limit"),
                "current_spend": c.get("current_spend"),
                "raw": c,
            }
        )
    return jsonify({"cards": data})


@ramp_bp.get("/users")
def ramp_users():
    payload, err, code = _ramp_get("users", {"page_size": request.args.get("page_size", "300")})
    if err:
        return jsonify({"error": err, "users": []}), code
    users = _extract_list(payload)
    data = [
        {
            "id": u.get("id"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "status": u.get("status"),
            "department": (u.get("department") or {}).get("name") if isinstance(u.get("department"), dict) else u.get("department"),
            "raw": u,
        }
        for u in users
    ]
    return jsonify({"users": data})


@ramp_bp.get("/departments")
def ramp_departments():
    payload, err, code = _ramp_get("departments", {"page_size": request.args.get("page_size", "200")})
    if err:
        return jsonify({"error": err, "departments": []}), code
    return jsonify({"departments": _extract_list(payload)})


@ramp_bp.get("/vendors")
def ramp_vendors():
    payload, err, code = _ramp_get("vendors", {"page_size": request.args.get("page_size", "300")})
    if err:
        return jsonify({"error": err, "vendors": []}), code
    return jsonify({"vendors": _extract_list(payload)})


@ramp_bp.get("/statements")
def ramp_statements():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "page_size", "start"):
        val = request.args.get(q)
        if val:
            params[q] = val
    payload, err, code = _ramp_get("statements", params)
    if err:
        return jsonify({"error": err, "statements": []}), code
    return jsonify({"statements": _extract_list(payload)})


@ramp_bp.get("/reimbursements")
def ramp_reimbursements():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "page_size", "start"):
        val = request.args.get(q)
        if val:
            params[q] = val
    payload, err, code = _ramp_get("reimbursements", params)
    if err:
        return jsonify({"error": err, "reimbursements": []}), code
    return jsonify({"reimbursements": _extract_list(payload)})
