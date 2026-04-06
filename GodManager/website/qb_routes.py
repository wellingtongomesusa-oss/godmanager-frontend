"""Rotas QuickBooks OAuth2 + sync → GAAP (Intuit). Requer: pip install intuit-oauth requests."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests as http_requests
from flask import flash, jsonify, redirect, request, session, url_for

# Tokens em memória (dev); em produção usar DB ou cofre.
QB_TOKENS: Dict[str, Optional[str]] = {
    "access_token": None,
    "refresh_token": None,
    "realm_id": None,
    "expires_at": None,  # ISO8601 access token expiry (approx.)
}

_qb_auth_singleton = None


def _get_qb_auth():
    """AuthClient singleton (intuit-oauth)."""
    global _qb_auth_singleton
    cid = (os.getenv("QB_CLIENT_ID") or "").strip()
    csec = (os.getenv("QB_CLIENT_SECRET") or "").strip()
    if not cid or not csec:
        return None
    if _qb_auth_singleton is not None:
        return _qb_auth_singleton
    from intuitlib.client import AuthClient

    redirect_uri = os.getenv(
        "QB_REDIRECT_URI",
        "http://localhost:3101/crm/integrations/quickbooks/callback",
    ).strip()
    env = (os.getenv("QB_ENVIRONMENT") or "sandbox").strip().lower()
    if env in ("prod", "production"):
        env = "production"
    else:
        env = "sandbox"
    _qb_auth_singleton = AuthClient(
        client_id=cid,
        client_secret=csec,
        redirect_uri=redirect_uri,
        environment=env,
    )
    return _qb_auth_singleton


def map_to_gaap(data: Dict[str, Any]) -> Dict[str, Any]:
    """Mapeia dados do QuickBooks para as 8 secções GAAP."""
    sections = {k: {"rows": []} for k in ["recv", "income", "cogs", "sga", "other", "cash", "tax", "dp"]}
    rid = 1

    inv_by_customer: Dict[str, float] = {}
    for inv in data.get("invoices") or []:
        name = (inv.get("CustomerRef") or {}).get("name", "Customer")
        try:
            amt = float(inv.get("TotalAmt", 0) or 0)
        except (TypeError, ValueError):
            amt = 0
        if amt > 0:
            inv_by_customer[name] = inv_by_customer.get(name, 0) + amt

    for name, total in sorted(inv_by_customer.items(), key=lambda x: -x[1]):
        sections["recv"]["rows"].append(
            {"id": rid, "desc": f"{name} (+)", "sign": "+", "amt": round(total, 2), "ok": True}
        )
        rid += 1

    bill_by_vendor: Dict[str, float] = {}
    for bill in data.get("bills") or []:
        name = (bill.get("VendorRef") or {}).get("name", "Vendor")
        try:
            amt = float(bill.get("TotalAmt", 0) or 0)
        except (TypeError, ValueError):
            amt = 0
        if amt > 0:
            bill_by_vendor[name] = bill_by_vendor.get(name, 0) + amt

    for name, total in sorted(bill_by_vendor.items(), key=lambda x: -x[1]):
        sections["cogs"]["rows"].append(
            {"id": rid, "desc": name, "sign": "-", "amt": round(total, 2), "ok": True}
        )
        rid += 1

    pur_by_cat: Dict[str, float] = {}
    for pur in data.get("purchases") or []:
        try:
            amt = float(pur.get("TotalAmt", 0) or 0)
        except (TypeError, ValueError):
            amt = 0
        if amt <= 0:
            continue
        cat = "General Expense"
        for line in pur.get("Line") or []:
            detail = line.get("AccountBasedExpenseLineDetail") or {}
            if detail.get("AccountRef"):
                cat = (detail["AccountRef"] or {}).get("name", cat)
                break
        pur_by_cat[cat] = pur_by_cat.get(cat, 0) + amt

    for cat, total in sorted(pur_by_cat.items(), key=lambda x: -x[1]):
        sections["sga"]["rows"].append(
            {"id": rid, "desc": cat, "sign": "-", "amt": round(total, 2), "ok": False}
        )
        rid += 1

    try:
        pay_total = sum(float(p.get("TotalAmt", 0) or 0) for p in (data.get("payments") or []))
    except (TypeError, ValueError):
        pay_total = 0
    if pay_total > 0:
        sections["income"]["rows"].append(
            {
                "id": rid,
                "desc": "Payments Received (QB)",
                "sign": "+",
                "amt": round(pay_total, 2),
                "ok": True,
            }
        )
        rid += 1

    now = datetime.now()
    return {
        "period": now.strftime("%b /%y"),
        "savedAt": now.isoformat(),
        "sections": sections,
    }


def register_quickbooks_routes(app):
    """Regista rotas /crm/integrations/quickbooks/* e /api/quickbooks/*."""

    @app.route("/crm/integrations/quickbooks/connect")
    def qb_connect():
        qb_auth = _get_qb_auth()
        if not qb_auth:
            flash("QuickBooks: defina QB_CLIENT_ID e QB_CLIENT_SECRET no .env", "warning")
            return redirect(url_for("crm_integrations_page"))
        try:
            from intuitlib.enums import Scopes

            auth_url = qb_auth.get_authorization_url([Scopes.ACCOUNTING])
            session["qb_state"] = qb_auth.state_token
            return redirect(auth_url)
        except Exception as e:
            flash(f"QuickBooks OAuth: {e}", "danger")
            return redirect(url_for("crm_integrations_page"))

    @app.route("/crm/integrations/quickbooks/callback")
    def qb_callback():
        qb_auth = _get_qb_auth()
        if not qb_auth:
            flash("QuickBooks não configurado.", "warning")
            return redirect(url_for("crm_integrations_page"))
        st = request.args.get("state")
        if st and session.get("qb_state") and st != session.get("qb_state"):
            flash("Estado OAuth inválido (CSRF). Tente de novo.", "danger")
            return redirect(url_for("crm_integrations_page"))
        err = request.args.get("error")
        if err:
            flash(f"QuickBooks: {err}", "danger")
            return redirect(url_for("crm_integrations_page"))
        auth_code = request.args.get("code")
        realm_id = request.args.get("realmId")
        if not auth_code:
            flash("Callback QuickBooks sem código.", "danger")
            return redirect(url_for("crm_integrations_page"))
        try:
            qb_auth.get_bearer_token(auth_code, realm_id=realm_id)
            QB_TOKENS["access_token"] = qb_auth.access_token
            QB_TOKENS["refresh_token"] = qb_auth.refresh_token
            QB_TOKENS["realm_id"] = realm_id or qb_auth.realm_id
            exp_in = getattr(qb_auth, "expires_in", None)
            if exp_in is not None:
                try:
                    exp_dt = datetime.now(timezone.utc) + timedelta(seconds=int(exp_in))
                    QB_TOKENS["expires_at"] = exp_dt.isoformat()
                except (TypeError, ValueError):
                    QB_TOKENS["expires_at"] = None
            else:
                QB_TOKENS["expires_at"] = None
            flash("QuickBooks conectado.", "success")
        except Exception as e:
            flash(f"Token QuickBooks: {e}", "danger")
        return redirect(url_for("crm_integrations_page"))

    @app.route("/crm/integrations/quickbooks/disconnect")
    def qb_disconnect():
        qb_auth = _get_qb_auth()
        tok = QB_TOKENS.get("refresh_token") or QB_TOKENS.get("access_token")
        if qb_auth and tok:
            try:
                qb_auth.revoke(token=tok)
            except Exception:
                pass
        QB_TOKENS.update({"access_token": None, "refresh_token": None, "realm_id": None, "expires_at": None})
        flash("QuickBooks desligado.", "info")
        return redirect(url_for("crm_integrations_page"))

    @app.route("/crm/integrations/quickbooks/sync")
    def qb_sync():
        if not QB_TOKENS.get("access_token"):
            return jsonify({"error": "QuickBooks não conectado"}), 401
        base = (os.getenv("QB_BASE_URL") or "https://sandbox-quickbooks.api.intuit.com").rstrip("/")
        realm = QB_TOKENS.get("realm_id")
        token = QB_TOKENS.get("access_token")
        if not realm:
            return jsonify({"error": "realm_id em falta"}), 400
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        results: Dict[str, Any] = {}
        queries = {
            "invoices": "Invoice",
            "payments": "Payment",
            "bills": "Bill",
            "purchases": "Purchase",
            "vendors": "Vendor",
            "customers": "Customer",
        }
        for key, entity in queries.items():
            try:
                url = f"{base}/v3/company/{realm}/query"
                q = f"SELECT * FROM {entity} MAXRESULTS 100"
                r = http_requests.get(
                    url,
                    headers=headers,
                    params={"query": q, "minorversion": "65"},
                    timeout=60,
                )
                data = r.json() if r.content else {}
                qr = data.get("QueryResponse") or {}
                results[key] = qr.get(entity) or []
                app.logger.info("QB sync %s: %s rows", key, len(results[key]))
            except Exception as e:
                results[key] = []
                app.logger.exception("QB sync %s failed: %s", key, e)
        gaap = map_to_gaap(results)
        return jsonify(gaap)

    @app.route("/api/quickbooks/raw/<entity>")
    def qb_raw(entity):
        if not QB_TOKENS.get("access_token"):
            return jsonify({"error": "Não conectado"}), 401
        ent = "".join(c for c in (entity or "") if c.isalnum())
        if not ent:
            return jsonify({"error": "Entidade inválida"}), 400
        base = (os.getenv("QB_BASE_URL") or "https://sandbox-quickbooks.api.intuit.com").rstrip("/")
        realm = QB_TOKENS.get("realm_id")
        if not realm:
            return jsonify({"error": "realm_id em falta"}), 400
        headers = {
            "Authorization": f"Bearer {QB_TOKENS['access_token']}",
            "Accept": "application/json",
        }
        url = f"{base}/v3/company/{realm}/query"
        r = http_requests.get(
            url,
            headers=headers,
            params={"query": f"SELECT * FROM {ent} MAXRESULTS 20", "minorversion": "65"},
            timeout=60,
        )
        try:
            return jsonify(r.json())
        except Exception:
            return jsonify({"error": "Resposta inválida", "status": r.status_code, "text": r.text[:500]}), 400

    @app.route("/api/quickbooks/status")
    def qb_status():
        return jsonify(
            {
                "connected": QB_TOKENS.get("access_token") is not None,
                "realm_id": QB_TOKENS.get("realm_id"),
                "expires_at": QB_TOKENS.get("expires_at"),
            }
        )
