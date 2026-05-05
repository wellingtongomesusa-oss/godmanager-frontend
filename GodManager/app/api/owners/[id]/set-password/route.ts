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
  if (!trimmed) return { firstName: 'Owner', lastName: '' };
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
      'owners',
      'write',
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const ownerWhere: { id: string; clientId?: string } = { id: params.id };
  if (user.role !== 'super_admin') {
    if (!user.clientId) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    ownerWhere.clientId = user.clientId;
  }

  const owner = await prisma.owner.findFirst({ where: ownerWhere });
  if (!owner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (!owner.email) {
    return NextResponse.json(
      { ok: false, error: 'owner_email_required' },
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
  const passwordHash = hashPassword(password);

  try {
    const byOwner = await prisma.user.findFirst({ where: { ownerId: owner.id } });

    if (byOwner) {
      const updated = await prisma.user.update({
        where: { id: byOwner.id },
        data: {
          passwordHash,
          role: 'owner',
          status: 'active',
          email: owner.email,
        },
      });

      await prisma.auditEntry
        .create({
          data: {
            actorId: user.id,
            actorEmail: user.email ?? null,
            action: 'owner_password_set',
            entity: 'user',
            entityId: updated.id,
            details: JSON.stringify({ ownerId: owner.id, action: 'updated' }),
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

    const byEmail = await prisma.user.findUnique({ where: { email: owner.email } });
    if (byEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: 'email_in_use',
          message: `Email ${owner.email} ja esta em uso por outro utilizador (role=${byEmail.role}).`,
        },
        { status: 409 },
      );
    }

    const { firstName, lastName } = splitName(owner.name);

    const created = await prisma.user.create({
      data: {
        email: owner.email,
        firstName,
        lastName,
        role: 'owner',
        status: 'active',
        clientId: owner.clientId,
        ownerId: owner.id,
        passwordHash,
      },
    });

    await prisma.auditEntry
      .create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'owner_password_set',
          entity: 'user',
          entityId: created.id,
          details: JSON.stringify({ ownerId: owner.id, action: 'created' }),
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
    console.error('[POST /api/owners/:id/set-password]', e);
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
