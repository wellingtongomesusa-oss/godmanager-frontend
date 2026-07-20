import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { twilioConfigured } from '@/lib/twilioSms';
import { issueSmsCode, verifySmsCode, normPhone } from '@/lib/smsMfaCode';

export const dynamic = 'force-dynamic';

/**
 * Verificação de telefone por SMS (base do 2FA por SMS) — para o usuário JÁ logado cadastrar/
 * confirmar o próprio telefone. A lógica de código vive em lib/smsMfaCode.ts (compartilhada com
 * o login). Só funciona com Twilio configurado (senão 503).
 *
 * POST { action: 'send', phone? }  → gera e envia código de 6 dígitos
 * POST { action: 'verify', code }  → valida; grava o telefone verificado no usuário
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!twilioConfigured()) {
    return NextResponse.json({ ok: false, error: 'SMS não configurado (Twilio).' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string; phone?: string };
  const action = String(body?.action || '');
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, phone: true } });
  if (!dbUser) return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });

  if (action === 'send') {
    const phone = normPhone(String(body?.phone || dbUser.phone || ''));
    const issued = await issueSmsCode(user.id, phone);
    if (!issued.ok) {
      const status = issued.status || 400;
      const msg =
        issued.error === 'invalid_phone'
          ? 'Telefone inválido. Use formato internacional, ex.: +14075551234.'
          : issued.error === 'rate_limited'
            ? 'Aguarde alguns segundos antes de reenviar.'
            : 'Falha ao enviar SMS.';
      return NextResponse.json({ ok: false, error: msg }, { status });
    }
    return NextResponse.json({ ok: true, sent: true, to: issued.to });
  }

  if (action === 'verify') {
    const check = await verifySmsCode(user.id, String(body?.code || ''));
    if (!check.ok) {
      const status = check.status || 400;
      const msg =
        check.error === 'no_pending'
          ? 'Nenhum código pendente. Envie um novo.'
          : check.error === 'expired'
            ? 'Código expirado. Envie um novo.'
            : check.error === 'too_many'
              ? 'Muitas tentativas. Envie um novo código.'
              : 'Código incorreto.';
      return NextResponse.json({ ok: false, error: msg }, { status });
    }
    // sucesso: grava o telefone verificado (se novo)
    if (check.phone && check.phone !== dbUser.phone) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: check.phone } });
    }
    return NextResponse.json({ ok: true, verified: true });
  }

  return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
}
