"""Seed idempotente: cria o tenant 'managerprop' (Manager Prop LLC).

Uso:
  python -m website.seed_managerprop --email admin@managerprop.com
  python -m website.seed_managerprop  (le ADMIN_EMAIL do env)

NAO cria properties, owners, leases, vendors. Isso vai numa proxima
tarefa (migrar do localStorage + CSVs).
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from website.db import SessionLocal
from website.db.models import Tenant, TenantUser, User


TENANT_SLUG = "managerprop"
TENANT_COMPANY = "Manager Prop LLC"
DEFAULT_PLAN = "enterprise"
CLERK_PLACEHOLDER = "PLACEHOLDER_WILL_REPLACE"


def seed(admin_email: str) -> dict:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL nao configurado. Defina DATABASE_URL_LOCAL ou DATABASE_URL.")
    sess = SessionLocal()
    try:
        tenant = sess.query(Tenant).filter_by(slug=TENANT_SLUG).one_or_none()
        if tenant is None:
            tenant = Tenant(
                id=uuid.uuid4(),
                slug=TENANT_SLUG,
                company_name=TENANT_COMPANY,
                plan=DEFAULT_PLAN,
                status="active",
            )
            sess.add(tenant)
            sess.flush()
            tenant_status = "created"
        else:
            tenant_status = "exists"

        user = sess.query(User).filter_by(email=admin_email).one_or_none()
        if user is None:
            user = User(
                id=uuid.uuid4(),
                clerk_id=CLERK_PLACEHOLDER + ":" + admin_email,
                email=admin_email,
                full_name="Admin Manager Prop",
            )
            sess.add(user)
            sess.flush()
            user_status = "created"
        else:
            user_status = "exists"

        link = sess.query(TenantUser).filter_by(tenant_id=tenant.id, user_id=user.id).one_or_none()
        if link is None:
            link = TenantUser(tenant_id=tenant.id, user_id=user.id, role="owner")
            sess.add(link)
            link_status = "created"
        else:
            link_status = "exists"

        sess.commit()
        return {
            "tenant_id": str(tenant.id),
            "tenant_status": tenant_status,
            "user_id": str(user.id),
            "user_status": user_status,
            "link_status": link_status,
        }
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
    args = parser.parse_args()
    if not args.email:
        print("ERRO: passe --email ou defina ADMIN_EMAIL", file=sys.stderr)
        return 2
    result = seed(args.email)
    for k, v in result.items():
        print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
