import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { verifyPassword } from '@/lib/password';
import { encryptField, decryptField } from '@/lib/encryption';
import { generateBase32Secret, otpauthUri, verifyTotp, generateBackupCodes } from '@/lib/totp';

export const dynamic = 'force-dynamic';

/** GET /api/auth/mfa → estado do MFA do usuário logado. */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { mfaEnabled: true } });
  return NextResponse.json({ ok: true, enabled: !!u?.mfaEnabled });
}

/**
 * POST /api/auth/mfa
 *   { action:'setup' }              → gera segredo (ainda não ativa), devolve otpauth URI + secret
 *   { action:'enable', code }       → confirma o código e ativa; devolve backup codes (uma vez)
 *   { action:'disable', password }  → desativa (exige a senha)
 */
export async function POST(req: Request) {
  const sess = await getCurrentUserFromSession();
  if (!sess) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string; password?: string };
  const action = String(body?.action || '');

  const user = await prisma.user.findUnique({ where: { id: sess.id } });
  if (!user) return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });

  if (action === 'setup') {
    const secret = generateBase32Secret();
    await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: encryptField(secret), mfaEnabled: false } });
    return NextResponse.json({ ok: true, secret, otpauthUri: otpauthUri(secret, user.email) });
  }

  if (action === 'enable') {
    const code = String(body?.code || '').trim();
    const secret = decryptField(user.mfaSecret) || '';
    if (!secret) return NextResponse.json({ ok: false, error: 'Rode o setup primeiro.' }, { status: 400 });
    if (!verifyTotp(secret, code)) {
      return NextResponse.json({ ok: false, error: 'Código inválido. Confira o app autenticador.' }, { status: 400 });
    }
    const { codes, hashes } = generateBackupCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaBackupCodes: encryptField(JSON.stringify(hashes)) },
    });
    return NextResponse.json({ ok: true, enabled: true, backupCodes: codes });
  }

  if (action === 'disable') {
    const password = String(body?.password || '');
    const { valid } = await verifyPassword(password, user.passwordHash);
    if (!valid) return NextResponse.json({ ok: false, error: 'Senha incorreta.' }, { status: 401 });
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
    });
    return NextResponse.json({ ok: true, enabled: false });
  }

  return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
}
