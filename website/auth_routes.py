"""Authentication + client user management API."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from models import ClientAccount, ClientUser

auth_bp = Blueprint("auth_api", __name__, url_prefix="/api")

_LOGIN_ATTEMPTS: Dict[str, List[datetime]] = {}
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 60


def _clean_attempts(ip: str) -> List[datetime]:
    now = datetime.utcnow()
    arr = _LOGIN_ATTEMPTS.get(ip, [])
    arr = [ts for ts in arr if (now - ts).total_seconds() <= _WINDOW_SECONDS]
    _LOGIN_ATTEMPTS[ip] = arr
    return arr


def _rate_limit_blocked(ip: str) -> bool:
    return len(_clean_attempts(ip)) >= _MAX_ATTEMPTS


def _mark_failed_attempt(ip: str) -> None:
    arr = _clean_attempts(ip)
    arr.append(datetime.utcnow())
    _LOGIN_ATTEMPTS[ip] = arr


def _client_ip() -> str:
    fwd = request.headers.get("X-Forwarded-For", "").strip()
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _user_payload(u: ClientUser) -> Dict[str, Any]:
    return {
        "id": u.id,
        "name": u.contact_name or "",
        "email": u.email or "",
        "company": u.company_name or "",
        "access_level": (u.access_level or "VIEWER").upper(),
        "plan": u.plan or "professional",
        "status": u.status or "active",
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "client_id": u.client_id,
        "is_owner": bool(u.is_owner),
    }


def _serialize_client(c: ClientAccount, users: List[ClientUser]) -> Dict[str, Any]:
    return {
        "id": c.id,
        "company_name": c.company_name,
        "contact_name": c.contact_name,
        "email": c.email,
        "phone": c.phone or "",
        "plan": c.plan or "professional",
        "access_level": (c.access_level or "VIEWER").upper(),
        "status": c.status or "active",
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "last_login": max([u.last_login for u in users if u.last_login] or [None]),
        "users": [_user_payload(u) for u in users],
    }


@auth_bp.before_app_request
def auth_touch_session() -> None:
    uid = session.get("client_user_id")
    if not uid:
        return
    now = datetime.utcnow()
    last_seen_raw = session.get("last_activity_at")
    if last_seen_raw:
        try:
            last_seen = datetime.fromisoformat(str(last_seen_raw))
            if (now - last_seen) > timedelta(hours=24):
                session.clear()
                return
        except Exception:
            session.clear()
            return
    session["last_activity_at"] = now.isoformat()


@auth_bp.post("/clients/register")
def register_client():
    payload = request.get_json(silent=True) or {}
    company_name = str(payload.get("company_name") or "").strip()
    contact_name = str(payload.get("contact_name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    phone = str(payload.get("phone") or "").strip()
    plan = str(payload.get("plan") or "professional").strip().lower()
    access_level = str(payload.get("access_level") or "VIEWER").strip().upper()
    password = str(payload.get("password") or "")
    if not company_name or not contact_name or not email or not password:
        return jsonify({"success": False, "error": "Campos obrigatórios ausentes"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Senha deve ter no mínimo 6 caracteres"}), 400
    if ClientUser.query.filter(db.func.lower(ClientUser.email) == email).first():
        return jsonify({"success": False, "error": "Email já cadastrado"}), 409
    if ClientAccount.query.filter(db.func.lower(ClientAccount.email) == email).first():
        return jsonify({"success": False, "error": "Email já cadastrado"}), 409

    client = ClientAccount(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        plan=plan,
        access_level=access_level,
        status="active",
    )
    db.session.add(client)
    db.session.flush()

    owner = ClientUser(
        client_id=client.id,
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        plan=plan,
        access_level=access_level,
        password_hash=generate_password_hash(password),
        status="active",
        is_owner=True,
    )
    db.session.add(owner)
    db.session.commit()
    return jsonify({"success": True, "user_id": owner.id, "client_id": client.id, "message": "Usuario registrado com sucesso"})


@auth_bp.get("/clients")
def list_clients():
    clients = ClientAccount.query.order_by(ClientAccount.created_at.desc(), ClientAccount.id.desc()).all()
    out = []
    for c in clients:
        users = ClientUser.query.filter_by(client_id=c.id).order_by(ClientUser.created_at.asc()).all()
        data = _serialize_client(c, users)
        ll = data["last_login"]
        data["last_login"] = ll.isoformat() if hasattr(ll, "isoformat") and ll else None
        out.append(data)
    return jsonify({"success": True, "clients": out})


@auth_bp.post("/clients/<int:client_id>/reset-password")
def reset_client_password(client_id: int):
    payload = request.get_json(silent=True) or {}
    new_password = str(payload.get("password") or "")
    if len(new_password) < 6:
        return jsonify({"success": False, "error": "Minimo 6 caracteres"}), 400
    owner = ClientUser.query.filter_by(client_id=client_id, is_owner=True).first()
    if not owner:
        return jsonify({"success": False, "error": "Cliente não encontrado"}), 404
    owner.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"success": True, "message": "Senha redefinida com sucesso"})


@auth_bp.get("/clients/<int:client_id>/users")
def list_client_users(client_id: int):
    client = ClientAccount.query.get(client_id)
    if not client:
        return jsonify({"success": False, "error": "Cliente não encontrado"}), 404
    users = ClientUser.query.filter_by(client_id=client_id).order_by(ClientUser.created_at.asc()).all()
    return jsonify({"success": True, "users": [_user_payload(u) for u in users]})


@auth_bp.post("/clients/<int:client_id>/users")
def add_client_user(client_id: int):
    client = ClientAccount.query.get(client_id)
    if not client:
        return jsonify({"success": False, "error": "Cliente não encontrado"}), 404
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    access_level = str(payload.get("access_level") or "VIEWER").strip().upper()
    if not name or not email or len(password) < 6:
        return jsonify({"success": False, "error": "Dados inválidos"}), 400
    if ClientUser.query.filter(db.func.lower(ClientUser.email) == email).first():
        return jsonify({"success": False, "error": "Email já cadastrado"}), 409
    row = ClientUser(
        client_id=client.id,
        company_name=client.company_name,
        contact_name=name,
        email=email,
        phone="",
        plan=client.plan,
        access_level=access_level,
        password_hash=generate_password_hash(password),
        status="active",
        is_owner=False,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"success": True, "user": _user_payload(row)})


@auth_bp.post("/clients/<int:client_id>/users/<int:user_id>/reset-password")
def reset_user_password(client_id: int, user_id: int):
    payload = request.get_json(silent=True) or {}
    new_password = str(payload.get("password") or "")
    if len(new_password) < 6:
        return jsonify({"success": False, "error": "Minimo 6 caracteres"}), 400
    user = ClientUser.query.filter_by(id=user_id, client_id=client_id).first()
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"success": True})


@auth_bp.post("/clients/<int:client_id>/users/<int:user_id>/status")
def set_user_status(client_id: int, user_id: int):
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status") or "").strip().lower()
    if status not in ("active", "inactive"):
        return jsonify({"success": False, "error": "Status inválido"}), 400
    user = ClientUser.query.filter_by(id=user_id, client_id=client_id).first()
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    if user.is_owner and status != "active":
        return jsonify({"success": False, "error": "Owner não pode ser desativado"}), 400
    user.status = status
    db.session.commit()
    return jsonify({"success": True})


@auth_bp.post("/auth/login")
def auth_login():
    ip = _client_ip()
    if _rate_limit_blocked(ip):
        return jsonify({"success": False, "error": "Muitas tentativas. Aguarde 1 minuto."}), 429
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    if not email or not password:
        return jsonify({"success": False, "error": "Email e senha são obrigatórios"}), 400
    user = ClientUser.query.filter(db.func.lower(ClientUser.email) == email).first()
    if not user or user.status != "active" or not check_password_hash(user.password_hash or "", password):
        _mark_failed_attempt(ip)
        return jsonify({"success": False, "error": "Email ou senha incorretos"}), 401
    user.last_login = datetime.utcnow()
    db.session.commit()
    session.clear()
    session.permanent = True
    session["client_user_id"] = user.id
    session["client_id"] = user.client_id
    session["last_activity_at"] = datetime.utcnow().isoformat()
    return jsonify({"success": True, "user": _user_payload(user)})


@auth_bp.get("/auth/session")
def auth_session():
    uid = session.get("client_user_id")
    if not uid:
        return jsonify({"logged_in": False})
    user = ClientUser.query.get(uid)
    if not user or user.status != "active":
        session.clear()
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "user": _user_payload(user)})


@auth_bp.post("/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"success": True, "logged_out": True})
