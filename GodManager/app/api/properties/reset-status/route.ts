import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdminFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await getCurrentAdminFromSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    const toReset = await prisma.property.findMany({
      where: { NOT: { status: 'pending' } },
      select: { id: true, status: true, code: true },
    });

    const result = await prisma.property.updateMany({
      data: { status: 'pending' },
    });

    if (toReset.length > 0) {
      await prisma.propertyStatusHistory.createMany({
        data: toReset.map((p) => ({
          propertyId: p.id,
          fromStatus: p.status,
          toStatus: 'pending',
          changedBy: admin.id,
          changedByEmail: admin.email,
          reason: 'reset_status_admin',
        })),
      });
    }

    await prisma.auditEntry
      .create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          action: 'reset_status',
          entity: 'properties',
          entityId: null,
          details: JSON.stringify({
            count: result.count,
            changed: toReset.length,
            scope: 'all',
          }),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      count: result.count,
      changed: toReset.length,
    });
  } catch (e) {
    console.error('[POST /api/properties/reset-status]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
