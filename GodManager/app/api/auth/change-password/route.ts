import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { verifyPassword, hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/auditServer';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const oldPassword = String(body?.oldPassword || '');
    const newPassword = String(body?.newPassword || '');

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ ok: false, error: 'Passwords sao obrigatorias.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'Nova password tem de ter pelo menos 8 caracteres.' }, { status: 400 });
    }
    if (oldPassword === newPassword) {
      return NextResponse.json({ ok: false, error: 'Nova password tem de ser diferente da actual.' }, { status: 400 });
    }

    const { valid } = await verifyPassword(oldPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Password actual incorrecta.' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, lastActive: new Date() },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'user.password_change',
      entity: 'user',
      entityId: user.id,
      targetUserId: user.id,
      details: 'password changed by user',
      clientId: user.clientId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/auth/change-password]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
