"""External owner/tenant forms: storage, uploads, PDF/CSV, approval hooks."""
from __future__ import annotations

import csv
import io
import json
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

_WEB_DIR = Path(__file__).resolve().parent
FORMS_STORE_PATH = _WEB_DIR / "data" / "external_forms.json"
OWNER_REGISTRY_PATH = _WEB_DIR / "data" / "owner_registry.json"
FORM_UPLOADS_DIR = _WEB_DIR / "data" / "form_uploads"
INVITES_PATH = _WEB_DIR / "data" / "form_invites.json"

STATUSES = frozenset({"submitted", "under_review", "approved", "rejected"})
FORM_TYPES = frozenset({"owner", "tenant"})


def _to_mmddyyyy(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).strftime("%m/%d/%Y")
        except ValueError:
            continue
    return s


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _ensure_dirs() -> None:
    FORMS_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FORM_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


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


def _load_forms_store() -> Dict[str, Any]:
    d = _load_json(
        FORMS_STORE_PATH,
        {"next_id": 1, "forms": []},
    )
    if "next_id" not in d:
        d["next_id"] = 1
    if "forms" not in d:
        d["forms"] = []
    return d


def _save_forms_store(store: Dict[str, Any]) -> None:
    _save_json(FORMS_STORE_PATH, store)


def _load_invites() -> Dict[str, Any]:
    d = _load_json(INVITES_PATH, {"invites": []})
    if "invites" not in d:
        d["invites"] = []
    return d


def _save_invites(data: Dict[str, Any]) -> None:
    _save_json(INVITES_PATH, data)


def _find_invite(token: str) -> Optional[Dict[str, Any]]:
    token = (token or "").strip()
    if not token:
        return None
    for inv in _load_invites()["invites"]:
        if str(inv.get("token")) == token:
            return inv
    return None


def _token_dir(token: str) -> Path:
    safe = secure_filename(token) or "invalid"
    return FORM_UPLOADS_DIR / safe


def _flatten(d: Any, prefix: str = "") -> List[Tuple[str, str]]:
    rows: List[Tuple[str, str]] = []
    if isinstance(d, dict):
        for k, v in d.items():
            p = f"{prefix}.{k}" if prefix else str(k)
            rows.extend(_flatten(v, p))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            rows.extend(_flatten(v, f"{prefix}[{i}]"))
    else:
        rows.append((prefix, str(d)))
    return rows


def _form_csv_row(form: Dict[str, Any]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["form_id", "type", "status", "submitted_at", "field", "value"])
    fid = form.get("id")
    ftype = form.get("type")
    st = form.get("status")
    ts = form.get("submitted_at")
    for key, val in _flatten(form.get("payload") or {}):
        w.writerow([fid, ftype, st, ts, key, val])
    docs = form.get("documents") or {}
    for dk, meta in docs.items():
        if isinstance(meta, dict):
            w.writerow([fid, ftype, st, ts, f"document.{dk}.filename", meta.get("filename", "")])
            w.writerow([fid, ftype, st, ts, f"document.{dk}.size", str(meta.get("size", ""))])
    return buf.getvalue()


def _pdf_for_form(form: Dict[str, Any]) -> bytes:
    try:
        from fpdf import FPDF
    except ImportError:
        return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"

    class Doc(FPDF):
        def header(self) -> None:
            self.set_font("Helvetica", "B", 14)
            self.cell(0, 10, "GodManager", ln=1)
            self.set_font("Helvetica", "", 10)
            self.cell(0, 6, f"Form #{form.get('id')} — {form.get('type','')}", ln=1)
            self.ln(4)

    pdf = Doc()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, json.dumps(form.get("payload") or {}, indent=2)[:8000])
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Documents attached:", ln=1)
    pdf.set_font("Helvetica", "", 9)
    for dk, meta in (form.get("documents") or {}).items():
        if isinstance(meta, dict):
            pdf.cell(0, 5, f"  - {dk}: {meta.get('filename','')}", ln=1)
    sig = (form.get("payload") or {}).get("signature_name") or (form.get("payload") or {}).get(
        "digital_signature"
    )
    dt = (form.get("payload") or {}).get("signature_date") or form.get("submitted_at")
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, f"Signature: {sig}", ln=1)
    pdf.cell(0, 6, f"Date: {dt}", ln=1)
    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)


def register_external_form_routes(bp: Blueprint) -> None:
    @bp.route("/form/invite", methods=["POST"])
    def form_invite():
        data = request.get_json(silent=True) or {}
        form_type = str(data.get("form_type") or "").strip().lower()
        if form_type not in FORM_TYPES:
            return jsonify({"error": "form_type must be owner or tenant"}), 400
        token = secrets.token_urlsafe(24)
        inv = {
            "token": token,
            "form_type": form_type,
            "created_at": _iso_now(),
            "property_address": str(data.get("property_address") or "").strip(),
            "property_id": str(data.get("property_id") or "").strip(),
            "agreed_rent": data.get("agreed_rent"),
            "lease_start": str(data.get("lease_start") or "").strip(),
            "lease_end": str(data.get("lease_end") or "").strip(),
            "email": str(data.get("email") or "").strip(),
        }
        st = _load_invites()
        st["invites"].append(inv)
        _save_invites(st)
        base = (request.headers.get("Origin") or "").strip() or str(request.host_url).rstrip("/")
        path = "form-owner.html" if form_type == "owner" else "form-tenant.html"
        url = f"{base}/{path}?token={token}"
        return jsonify({"token": token, "url": url, "invite": inv})

    @bp.route("/form/upload-doc", methods=["POST"])
    def form_upload_doc():
        token = (request.form.get("token") or "").strip()
        doc_key = (request.form.get("doc_key") or "").strip()
        if "file" not in request.files or not doc_key:
            return jsonify({"error": "file and doc_key required"}), 400
        f = request.files["file"]
        if not f or not f.filename:
            return jsonify({"error": "empty file"}), 400
        if not token:
            token = secrets.token_urlsafe(24)
        udir = _token_dir(token)
        udir.mkdir(parents=True, exist_ok=True)
        safe = secure_filename(f.filename) or "upload"
        dest_name = f"{doc_key}_{safe}"
        dest = udir / dest_name
        f.save(str(dest))
        size = dest.stat().st_size if dest.is_file() else 0
        rel = f"{token}/{dest_name}"
        return jsonify(
            {
                "ok": True,
                "token": token,
                "doc_key": doc_key,
                "filename": safe,
                "size": size,
                "stored_rel": rel,
            }
        )

    @bp.route("/form/file/<token>/<path:filename>", methods=["GET"])
    def form_serve_file(token: str, filename: str):
        base = _token_dir(token)
        fp = (base / filename).resolve()
        try:
            if not str(fp).startswith(str(base.resolve())):
                return jsonify({"error": "invalid path"}), 400
        except OSError:
            return jsonify({"error": "invalid"}), 400
        if not fp.is_file():
            return jsonify({"error": "not found"}), 404
        return send_file(str(fp), as_attachment=False, download_name=filename)

    @bp.route("/form/owner", methods=["POST"])
    def form_submit_owner():
        data = request.get_json(silent=True) or {}
        token = str(data.get("token") or "").strip()
        if not token:
            return jsonify({"error": "token required"}), 400
        store = _load_forms_store()
        fid = int(store["next_id"])
        share = secrets.token_urlsafe(16)
        inv = _find_invite(token)
        invite_meta = {k: v for k, v in (inv or {}).items() if k != "token"}
        row = {
            "id": fid,
            "share_token": share,
            "invite_token": token,
            "type": "owner",
            "status": "submitted",
            "submitted_at": _iso_now(),
            "payload": {k: v for k, v in data.items() if k not in ("documents",)},
            "documents": data.get("documents") or {},
            "invite_meta": invite_meta,
        }
        store["forms"].append(row)
        store["next_id"] = fid + 1
        _save_forms_store(store)
        return jsonify({"ok": True, "id": fid, "share_token": share, "status": row["status"]})

    @bp.route("/form/tenant", methods=["POST"])
    def form_submit_tenant():
        data = request.get_json(silent=True) or {}
        token = str(data.get("token") or "").strip()
        if not token:
            return jsonify({"error": "token required"}), 400
        store = _load_forms_store()
        fid = int(store["next_id"])
        share = secrets.token_urlsafe(16)
        inv = _find_invite(token)
        invite_meta = {k: v for k, v in (inv or {}).items() if k != "token"}
        row = {
            "id": fid,
            "share_token": share,
            "invite_token": token,
            "type": "tenant",
            "status": "submitted",
            "submitted_at": _iso_now(),
            "payload": {k: v for k, v in data.items() if k not in ("documents",)},
            "documents": data.get("documents") or {},
            "invite_meta": invite_meta,
        }
        store["forms"].append(row)
        store["next_id"] = fid + 1
        _save_forms_store(store)
        return jsonify({"ok": True, "id": fid, "share_token": share, "status": row["status"]})

    @bp.route("/form/status/<token>", methods=["GET"])
    def form_status(token: str):
        inv = _find_invite(token)
        if inv:
            return jsonify(
                {
                    "ok": True,
                    "invite": True,
                    "form_type": inv.get("form_type"),
                    "property_address": inv.get("property_address"),
                    "property_id": inv.get("property_id"),
                    "agreed_rent": inv.get("agreed_rent"),
                    "lease_start": inv.get("lease_start"),
                    "lease_end": inv.get("lease_end"),
                }
            )
        store = _load_forms_store()
        for f in store["forms"]:
            if str(f.get("share_token")) == token or str(f.get("invite_token")) == token:
                return jsonify(
                    {
                        "ok": True,
                        "invite": False,
                        "form_id": f.get("id"),
                        "type": f.get("type"),
                        "status": f.get("status"),
                        "submitted_at": f.get("submitted_at"),
                    }
                )
        return jsonify({"ok": False, "error": "unknown token"}), 404

    @bp.route("/forms", methods=["GET"])
    def forms_list():
        store = _load_forms_store()
        qtype = (request.args.get("type") or "").strip().lower()
        qst = (request.args.get("status") or "").strip().lower()
        qsearch = (request.args.get("search") or "").strip().lower()
        rows: List[Dict[str, Any]] = []
        for f in store.get("forms") or []:
            if qtype and str(f.get("type")) != qtype:
                continue
            if qst and str(f.get("status")) != qst:
                continue
            p = f.get("payload") or {}
            blob = json.dumps(p).lower()
            name = str(p.get("full_name") or (p.get("first_name", "") + " " + p.get("last_name", ""))).strip()
            em = str(p.get("email") or "")
            if qsearch and qsearch not in blob and qsearch not in name.lower() and qsearch not in em.lower():
                continue
            docs = f.get("documents") or {}
            done = sum(1 for _k, v in docs.items() if isinstance(v, dict) and v.get("filename"))
            exp = 8 if f.get("type") == "owner" else 10
            rows.append(
                {
                    "id": f.get("id"),
                    "submitted_at": f.get("submitted_at"),
                    "type": f.get("type"),
                    "name": name or "—",
                    "email": em or "—",
                    "documents_done": min(done, exp),
                    "documents_total": exp,
                    "status": f.get("status"),
                    "share_token": f.get("share_token"),
                }
            )
        rows.sort(key=lambda x: -int(x.get("id") or 0))
        return jsonify({"forms": rows})

    @bp.route("/forms/<int:form_id>", methods=["GET"])
    def forms_get(form_id: int):
        store = _load_forms_store()
        for f in store["forms"]:
            if int(f.get("id") or 0) == form_id:
                return jsonify(f)
        return jsonify({"error": "not found"}), 404

    @bp.route("/forms/<int:form_id>/status", methods=["PUT"])
    def forms_put_status(form_id: int):
        data = request.get_json(silent=True) or {}
        st = str(data.get("status") or "").strip().lower()
        if st not in STATUSES:
            return jsonify({"error": "invalid status"}), 400
        store = _load_forms_store()
        for i, f in enumerate(store["forms"]):
            if int(f.get("id") or 0) == form_id:
                f["status"] = st
                store["forms"][i] = f
                _save_forms_store(store)
                return jsonify({"ok": True, "id": form_id, "status": st})
        return jsonify({"error": "not found"}), 404

    @bp.route("/forms/<int:form_id>/approve", methods=["POST"])
    def forms_approve(form_id: int):
        import importlib

        ar = importlib.import_module("appfolio_routes")
        store = _load_forms_store()
        form: Optional[Dict[str, Any]] = None
        for f in store["forms"]:
            if int(f.get("id") or 0) == form_id:
                form = f
                break
        if not form:
            return jsonify({"error": "not found"}), 404
        if form.get("status") == "approved":
            return jsonify({"ok": True, "message": "already approved"})

        p = form.get("payload") or {}
        inv = form.get("invite_meta") or {}

        if form.get("type") == "owner":
            ostore = _load_json(OWNER_REGISTRY_PATH, {"next_id": 1, "owners": []})
            oid = int(ostore["next_id"])
            ostore["next_id"] = oid + 1
            owner_row = {
                "id": oid,
                "created_at": _iso_now(),
                "full_name": str(p.get("full_name") or ""),
                "company": str(p.get("company_llc") or ""),
                "email": str(p.get("email") or ""),
                "phone": str(p.get("phone") or ""),
                "from_form_id": form_id,
                "payload_snapshot": p,
            }
            ostore.setdefault("owners", []).append(owner_row)
            _save_json(OWNER_REGISTRY_PATH, ostore)
            form["status"] = "approved"
            form["integrated_owner_id"] = oid
        else:
            tstore = ar._load_tenant_registry_store()
            nid = int(tstore["next_tenant_id"])
            tstore["next_tenant_id"] = nid + 1
            now = ar._iso_now()
            row: Dict[str, Any] = {"id": nid, "created_at": now, "updated_at": now}
            row.update(ar._tenant_internal_defaults())
            lease_s = str(inv.get("lease_start") or p.get("lease_start") or "").strip()
            lease_e = str(inv.get("lease_end") or p.get("lease_end") or "").strip()
            prop_id = str(inv.get("property_id") or p.get("property_id") or "").strip()
            agreed = float(inv.get("agreed_rent") or p.get("agreed_rent") or p.get("monthly_income") or 0.0)
            if not lease_s or not lease_e:
                lease_s = datetime.now().strftime("%Y-%m-%d")
                y = datetime.now().year + 1
                lease_e = f"{y}-{datetime.now().strftime('%m-%d')}"
            if not prop_id:
                prop_id = "ext-" + str(form_id)
            if agreed <= 0:
                agreed = float(p.get("monthly_income") or 0.0) or 0.01
            pdata = {
                "first_name": str(p.get("first_name") or "").strip(),
                "last_name": str(p.get("last_name") or "").strip(),
                "email": str(p.get("email") or "").strip(),
                "phone": str(p.get("phone") or "").strip(),
                "phone_secondary": str(p.get("secondary_phone") or ""),
                "date_of_birth": _to_mmddyyyy(str(p.get("date_of_birth") or "")),
                "ssn_last4": str(p.get("ssn_last4") or ""),
                "drivers_license": str(p.get("drivers_license") or ""),
                "emergency_contact_name": str(p.get("emergency_contact_name") or ""),
                "emergency_contact_phone": str(p.get("emergency_contact_phone") or ""),
                "current_address": str(p.get("current_address") or ""),
                "employer_name": str(p.get("employer_name") or ""),
                "employer_phone": str(p.get("employer_phone") or ""),
                "monthly_income": float(p.get("monthly_income") or 0.0),
                "notes": str(p.get("reason_for_moving") or "")[:500],
                "bank_name": str(p.get("bank_name") or ""),
                "routing_number": str(p.get("routing_number") or ""),
                "account_number": str(p.get("account_number") or ""),
                "account_type": str(p.get("account_type") or "checking").lower(),
                "property_id": prop_id,
                "property_address": str(inv.get("property_address") or p.get("property_applying_for") or ""),
                "lease_start": _to_mmddyyyy(lease_s),
                "lease_end": _to_mmddyyyy(lease_e),
                "move_in_date": _to_mmddyyyy(str(p.get("move_in_date") or lease_s)),
                "asking_rent": agreed,
                "agreed_rent": agreed,
                "security_deposit": float(p.get("security_deposit") or 0.0),
                "status": "approved",
            }
            err = ar._apply_tenant_payload(row, pdata, partial=False)
            if err:
                tstore["next_tenant_id"] = nid
                return jsonify({"error": err}), 400
            docs_dir = ar.TENANT_DOCS_DIR
            did = int(tstore["next_doc_id"])
            doc_map = {
                "id_front": "id_front",
                "id_back": "id_back",
                "proof_income": "pay_stub",
                "bank_statements": "bank_statement",
                "employment_letter": "other",
                "credit_boom": "boom_report",
                "landlord_reference": "other",
                "pet_docs": "other",
                "renters_insurance": "other",
                "vehicle_registration": "other",
            }
            for dk, meta in (form.get("documents") or {}).items():
                if not isinstance(meta, dict):
                    continue
                rel = str(meta.get("stored_rel") or "")
                if not rel or ".." in rel:
                    continue
                src = FORM_UPLOADS_DIR / rel
                if not src.is_file():
                    continue
                safe_fn = str(meta.get("filename") or "doc")
                subdir = Path(str(nid))
                docs_dir.mkdir(parents=True, exist_ok=True)
                (docs_dir / subdir).mkdir(parents=True, exist_ok=True)
                rel_out = str(subdir / f"{did}_{safe_fn}")
                dest = docs_dir / rel_out
                shutil.copy2(str(src), str(dest))
                doc_type = doc_map.get(dk, "other")
                row.setdefault("documents", []).append(
                    {
                        "id": did,
                        "filename": safe_fn,
                        "type": doc_type,
                        "uploaded_at": now,
                        "stored_relpath": rel_out,
                    }
                )
                did += 1
            tstore["next_doc_id"] = did
            tstore["tenants"].append(row)
            ar._save_tenant_registry_store(tstore)
            form["integrated_tenant_id"] = nid
            form["status"] = "approved"

        for i, f in enumerate(store["forms"]):
            if int(f.get("id") or 0) == form_id:
                store["forms"][i] = form
                break
        _save_forms_store(store)
        return jsonify({"ok": True, "id": form_id, "status": form.get("status")})

    @bp.route("/forms/<int:form_id>/reject", methods=["POST"])
    def forms_reject(form_id: int):
        store = _load_forms_store()
        for i, f in enumerate(store["forms"]):
            if int(f.get("id") or 0) == form_id:
                f["status"] = "rejected"
                store["forms"][i] = f
                _save_forms_store(store)
                return jsonify({"ok": True, "id": form_id, "status": "rejected"})
        return jsonify({"error": "not found"}), 404

    @bp.route("/forms/<int:form_id>/pdf", methods=["GET"])
    def forms_pdf(form_id: int):
        store = _load_forms_store()
        for f in store["forms"]:
            if int(f.get("id") or 0) == form_id:
                pdf_bytes = _pdf_for_form(f)
                return send_file(
                    io.BytesIO(pdf_bytes),
                    mimetype="application/pdf",
                    as_attachment=True,
                    download_name=f"godmanager-form-{form_id}.pdf",
                )
        return jsonify({"error": "not found"}), 404

    @bp.route("/forms/<int:form_id>/csv", methods=["GET"])
    def forms_csv(form_id: int):
        store = _load_forms_store()
        for f in store["forms"]:
            if int(f.get("id") or 0) == form_id:
                csv_data = _form_csv_row(f)
                return send_file(
                    io.BytesIO(csv_data.encode("utf-8")),
                    mimetype="text/csv",
                    as_attachment=True,
                    download_name=f"godmanager-form-{form_id}.csv",
                )
        return jsonify({"error": "not found"}), 404
