import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const SetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: 'Tenant', lastName: '' };
  const parts = trimmed.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    await requirePermission(
      { id: user.id, role: user.role, clientId: user.clientId ?? null },
      'tenants',
      'write',
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const tenantWhere: { id: string; clientId?: string } = { id: params.id };
  if (user.role !== 'super_admin') {
    if (!user.clientId) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    tenantWhere.clientId = user.clientId;
  }

  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere,
    select: {
      id: true,
      name: true,
      email: true,
      clientId: true,
    },
  });
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (!tenant.email) {
    return NextResponse.json(
      { ok: false, error: 'tenant_email_required' },
      { status: 400 },
    );
  }

  if (!tenant.clientId) {
    return NextResponse.json(
      { ok: false, error: 'tenant_sem_empresa' },
      { status: 400 },
    );
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = SetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const password = parsed.data.password;
  const passwordHash = await hashPassword(password);

  try {
    const byTenant = await prisma.user.findFirst({ where: { tenantId: tenant.id } });

    if (byTenant) {
      const updated = await prisma.user.update({
        where: { id: byTenant.id },
        data: {
          passwordHash,
          role: 'tenant',
          status: 'active',
          email: tenant.email,
        },
      });

      await prisma.auditEntry
        .create({
          data: {
            actorId: user.id,
            actorEmail: user.email ?? null,
            action: 'tenant_password_set',
            entity: 'user',
            entityId: updated.id,
            details: JSON.stringify({ tenantId: tenant.id, action: 'updated' }),
          },
        })
        .catch(() => {});

      return NextResponse.json({
        ok: true,
        userId: updated.id,
        email: updated.email,
        action: 'updated',
      });
    }

    const byEmail = await prisma.user.findUnique({ where: { email: tenant.email } });
    if (byEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: 'email_in_use',
          message: `Email ${tenant.email} ja esta em uso por outro utilizador (role=${byEmail.role}).`,
        },
        { status: 409 },
      );
    }

    const { firstName, lastName } = splitName(tenant.name);

    const created = await prisma.user.create({
      data: {
        email: tenant.email,
        firstName,
        lastName,
        role: 'tenant',
        status: 'active',
        clientId: tenant.clientId,
        tenantId: tenant.id,
        passwordHash,
      },
    });

    await prisma.auditEntry
      .create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'tenant_password_set',
          entity: 'user',
          entityId: created.id,
          details: JSON.stringify({ tenantId: tenant.id, action: 'created' }),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      userId: created.id,
      email: created.email,
      action: 'created',
    });
  } catch (e: unknown) {
    console.error('[POST /api/tenants/:id/set-password]', e);
    const code =
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      typeof (e as { code: unknown }).code === 'string'
        ? (e as { code: string }).code
        : '';
    if (code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
