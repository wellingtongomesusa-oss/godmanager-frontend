import { NextResponse } from 'next/server';
import type { ClientProductType } from '@prisma/client';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
  }

  let productType: ClientProductType | null = null;
  let companyName: string | null = null;

  if (user.role === 'super_admin' && user.clientId == null) {
    productType = null;
    companyName = null;
  } else if (user.clientId) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: user.clientId },
        select: { productType: true, companyName: true },
      });
      productType = client?.productType ?? 'PROPERTY_MANAGEMENT';
      companyName = client?.companyName ?? null;
    } catch (e) {
      console.error('[api/auth/me] falha ao obter Client', e);
      productType = null;
      companyName = null;
    }
  } else {
    productType = null;
    companyName = null;
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clientId: user.clientId,
      companyName,
      vendorId: user.vendorId ?? null,
      status: user.status,
      permissions: user.permissions,
      menuAccess: user.menuAccess,
      lastActive: user.lastActive,
      createdAt: user.createdAt,
      productType,
    },
  });
}
