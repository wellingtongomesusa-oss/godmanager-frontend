import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
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
      status: user.status,
      permissions: user.permissions,
      lastActive: user.lastActive,
      createdAt: user.createdAt,
    },
  });
}
