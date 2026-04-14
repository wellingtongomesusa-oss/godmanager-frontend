"""Ramp API proxy routes for GodManager."""
from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

ramp_bp = Blueprint("ramp", __name__, url_prefix="/api/ramp")

_TOKEN_LOCK = threading.Lock()
_TOKEN_CACHE: Dict[str, Any] = {"value": None, "expires_at": None}
_DEFAULT_TIMEOUT = 25


def _ramp_base_url() -> str:
    return os.getenv("RAMP_API_BASE_URL", "https://api.ramp.com/developer/v1").rstrip("/")


def _ramp_creds() -> Tuple[str, str]:
    return (os.getenv("RAMP_CLIENT_ID", "").strip(), os.getenv("RAMP_CLIENT_SECRET", "").strip())


def _ramp_scope() -> str:
    # Ramp client_credentials requires scope; allow override via env.
    return os.getenv(
        "RAMP_SCOPE",
        "cards:read users:read departments:read vendors:read statements:read reimbursements:read transactions:read",
    ).strip() or "read"


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
    try:
        resp = requests.get(url, headers=headers, params=params or {}, timeout=_DEFAULT_TIMEOUT)
    except requests.RequestException as exc:
        return None, f"Erro de rede na API Ramp: {exc}", 502

    if not resp.ok:
        snippet = (resp.text or "")[:300]
        return None, f"Ramp retornou HTTP {resp.status_code}: {snippet}", resp.status_code

    return (resp.json() if resp.content else {}), None, 200


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


@ramp_bp.get("/transactions")
def ramp_transactions():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "start", "page_size"):
        val = request.args.get(q)
        if val:
            params[q] = val

    payload, err, code = _ramp_get("transactions", params)
    if err:
        return jsonify({"error": err, "transactions": []}), code

    rows = _extract_list(payload)
    txs = [
        {
            "id": tx.get("id"),
            "amount": _tx_amount(tx),
            "merchant_name": _tx_merchant(tx),
            "category": _tx_category(tx),
            "card_holder": _tx_holder(tx),
            "card_last4": str((tx.get("card") or {}).get("last_four") or tx.get("card_last_four") or ""),
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
            "start": payload.get("start") if isinstance(payload, dict) else None,
            "next_start": payload.get("next_start") if isinstance(payload, dict) else None,
            "has_more": bool((payload or {}).get("has_more")) if isinstance(payload, dict) else False,
        }
    )


@ramp_bp.get("/transactions/summary")
def ramp_transactions_summary():
    params: Dict[str, Any] = {}
    for q in ("from_date", "to_date", "start", "page_size"):
        val = request.args.get(q)
        if val:
            params[q] = val
    if "page_size" not in params:
        params["page_size"] = "500"

    payload, err, code = _ramp_get("transactions", params)
    if err:
        return jsonify({"error": err, "summary": {}}), code

    rows = _extract_list(payload)
    by_merchant: Dict[str, float] = {}
    by_category: Dict[str, float] = {}
    by_user: Dict[str, float] = {}
    by_month: Dict[str, float] = {}
    total_spent = 0.0

    for tx in rows:
        amount = _tx_amount(tx)
        total_spent += amount
        merchant = _tx_merchant(tx)
        category = _tx_category(tx)
        holder = _tx_holder(tx)
        month = _tx_month(tx)
        by_merchant[merchant] = by_merchant.get(merchant, 0.0) + amount
        by_category[category] = by_category.get(category, 0.0) + amount
        by_user[holder] = by_user.get(holder, 0.0) + amount
        by_month[month] = by_month.get(month, 0.0) + amount

    return jsonify(
        {
            "summary": {
                "total_spent": total_spent,
                "count": len(rows),
                "by_merchant": by_merchant,
                "by_category": by_category,
                "by_user": by_user,
                "by_month": by_month,
            }
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
