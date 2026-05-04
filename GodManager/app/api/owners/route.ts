import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const CreateOwnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(200)
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

function clientScopeWhere(user: { role: string; clientId: string | null }) {
  if (user.role === 'super_admin') return {};
  if (!user.clientId) return { id: '__forbidden__' };
  return { clientId: user.clientId };
}

export async function GET(req: NextRequest) {
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
    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 1000);

    const where: Prisma.OwnerWhereInput = {
      ...clientScopeWhere({ role: user.role, clientId: user.clientId ?? null }),
      active: true,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const owners = await prisma.owner.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { properties: true, users: true } },
      },
      orderBy: [{ name: 'asc' }],
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      owners: owners.map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        notes: o.notes,
        active: o.active,
        clientId: o.clientId,
        clientName: o.client?.companyName ?? null,
        propertiesCount: o._count.properties,
        usersCount: o._count.users,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      total: owners.length,
    });
  } catch (e) {
    console.error('[GET /api/owners]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    await requirePermission(
      { id: user.id, role: user.role, clientId: user.clientId ?? null },
      'owners',
      'create',
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  let targetClientId: string | null = null;
  if (user.role === 'super_admin') {
    const rawCid = raw.clientId;
    targetClientId =
      typeof rawCid === 'string' && rawCid.trim() !== '' ? rawCid.trim() : null;
    if (!targetClientId) {
      return NextResponse.json(
        { ok: false, error: 'clientId required for super_admin' },
        { status: 400 },
      );
    }
    const exists = await prisma.client.findUnique({ where: { id: targetClientId } });
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'client not found' }, { status: 404 });
    }
  } else {
    if (!user.clientId) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    targetClientId = user.clientId;
  }

  try {
    const parsed = CreateOwnerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'validation', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const email = data.email && data.email !== '' ? data.email : null;

    if (email) {
      const dup = await prisma.owner.findUnique({
        where: { clientId_email: { clientId: targetClientId!, email } },
      });
      if (dup) {
        return NextResponse.json({ ok: false, error: 'duplicate_email' }, { status: 409 });
      }
    }

    const owner = await prisma.owner.create({
      data: {
        clientId: targetClientId!,
        name: data.name,
        email,
        phone: data.phone && data.phone !== '' ? data.phone : null,
        notes: data.notes && data.notes !== '' ? data.notes : null,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, owner: { id: owner.id, name: owner.name } });
  } catch (e: unknown) {
    console.error('[POST /api/owners]', e);
    const code =
      e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
