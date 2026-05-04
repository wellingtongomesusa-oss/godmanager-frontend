import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const UpdateOwnerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(200).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

async function loadOwnerScoped(
  ownerId: string,
  user: { role: string; clientId: string | null },
) {
  const where: { id: string; clientId?: string } = { id: ownerId };
  if (user.role !== 'super_admin') {
    if (!user.clientId) return null;
    where.clientId = user.clientId;
  }
  return prisma.owner.findFirst({
    where,
    include: {
      client: { select: { id: true, companyName: true } },
      properties: {
        select: { id: true, code: true, address: true, status: true },
        orderBy: { code: 'asc' },
      },
      _count: { select: { users: true } },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    await requirePermission(
      { id: user.id, role: user.role, clientId: user.clientId ?? null },
      'owners',
      'read',
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const owner = await loadOwnerScoped(params.id, {
      role: user.role,
      clientId: user.clientId ?? null,
    });
    if (!owner) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        notes: owner.notes,
        active: owner.active,
        clientId: owner.clientId,
        clientName: owner.client?.companyName ?? null,
        properties: owner.properties,
        usersCount: owner._count.users,
        createdAt: owner.createdAt.toISOString(),
        updatedAt: owner.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('[GET /api/owners/:id]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    await requirePermission(
      { id: user.id, role: user.role, clientId: user.clientId ?? null },
      'owners',
      'write',
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const owner = await loadOwnerScoped(params.id, {
      role: user.role,
      clientId: user.clientId ?? null,
    });
    if (!owner) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = UpdateOwnerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'validation', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const updateData: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      active?: boolean;
    } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email === '' ? null : data.email;
    if (data.phone !== undefined) updateData.phone = data.phone === '' ? null : data.phone;
    if (data.notes !== undefined) updateData.notes = data.notes === '' ? null : data.notes;
    if (data.active !== undefined) updateData.active = data.active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: 'validation', details: 'no fields to update' }, { status: 400 });
    }

    if (updateData.email) {
      const dup = await prisma.owner.findUnique({
        where: {
          clientId_email: { clientId: owner.clientId, email: updateData.email },
        },
      });
      if (dup && dup.id !== owner.id) {
        return NextResponse.json({ ok: false, error: 'duplicate_email' }, { status: 409 });
      }
    }

    const propagateName = updateData.name !== undefined && updateData.name !== owner.name;
    const propagateEmail = updateData.email !== undefined && updateData.email !== owner.email;
    const propagatePhone = updateData.phone !== undefined && updateData.phone !== owner.phone;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.owner.update({
        where: { id: owner.id },
        data: updateData,
      });

      let propsUpdated = 0;
      if (propagateName || propagateEmail || propagatePhone) {
        const propData: { ownerName?: string; ownerEmail?: string | null; ownerPhone?: string | null } = {};
        if (propagateName) propData.ownerName = updated.name;
        if (propagateEmail) propData.ownerEmail = updated.email;
        if (propagatePhone) propData.ownerPhone = updated.phone;

        const r = await tx.property.updateMany({
          where: { ownerId: owner.id },
          data: propData,
        });
        propsUpdated = r.count;
      }

      await tx.auditEntry
        .create({
          data: {
            actorId: user.id,
            actorEmail: user.email,
            action: 'owner_update',
            entity: 'owner',
            entityId: owner.id,
            details: JSON.stringify({
              changed: Object.keys(updateData),
              propsUpdated,
              propagated: { propagateName, propagateEmail, propagatePhone },
            }),
            clientId: user.clientId,
          },
        })
        .catch(() => {});

      return { updated, propsUpdated };
    });

    return NextResponse.json({
      ok: true,
      owner: {
        id: result.updated.id,
        name: result.updated.name,
        email: result.updated.email,
        phone: result.updated.phone,
        notes: result.updated.notes,
        active: result.updated.active,
      },
      propsUpdated: result.propsUpdated,
    });
  } catch (e: unknown) {
    console.error('[PATCH /api/owners/:id]', e);
    const code =
      e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
