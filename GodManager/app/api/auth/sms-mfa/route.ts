import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { sendSms, twilioConfigured } from '@/lib/twilioSms';

export const dynamic = 'force-dynamic';

/**
 * Verificação de telefone por SMS (base do 2FA por SMS). Puramente aditivo — não toca no login.
 * Só funciona se o Twilio estiver configurado (senão 503). Guarda o código no AppSetting
 * (sem migration), com hash, expiração de 5 min, limite de tentativas e rate limit de reenvio.
 *
 * POST { action: 'send', phone? }  → gera e envia código de 6 dígitos
 * POST { action: 'verify', code }  → valida; grava o telefone verificado no usuário
 */
const keyOf = (uid: string) => `sms_mfa:${uid}`;
const hashCode = (c: string) => crypto.createHash('sha256').update('gm-sms:' + c).digest('hex');
const normPhone = (p: string) => p.replace(/[\s()-]/g, '');

type CodeRec = { hash: string; expires: number; attempts: number; lastSent: number; phone: string };

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
    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: 'Telefone inválido. Use formato internacional, ex.: +14075551234.' }, { status: 400 });
    }
    const existing = await prisma.appSetting.findUnique({ where: { key: keyOf(user.id) } });
    const prev = (existing?.value as CodeRec | null) || null;
    if (prev?.lastSent && Date.now() - prev.lastSent < 30_000) {
      return NextResponse.json({ ok: false, error: 'Aguarde alguns segundos antes de reenviar.' }, { status: 429 });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    const rec: CodeRec = { hash: hashCode(code), expires: Date.now() + 5 * 60_000, attempts: 0, lastSent: Date.now(), phone };
    await prisma.appSetting.upsert({
      where: { key: keyOf(user.id) },
      create: { key: keyOf(user.id), value: rec, updatedBy: user.id },
      update: { value: rec, updatedBy: user.id },
    });
    const r = await sendSms(phone, `GodManager: seu código de verificação é ${code}. Expira em 5 minutos.`);
    if (!r.ok) return NextResponse.json({ ok: false, error: 'Falha ao enviar SMS: ' + (r.error || '') }, { status: 502 });
    return NextResponse.json({ ok: true, sent: true, to: phone.replace(/.(?=.{4})/g, '*') });
  }

  if (action === 'verify') {
    const code = String(body?.code || '').trim();
    const rec = await prisma.appSetting.findUnique({ where: { key: keyOf(user.id) } });
    const v = (rec?.value as CodeRec | null) || null;
    if (!v?.hash || !v?.expires) return NextResponse.json({ ok: false, error: 'Nenhum código pendente. Envie um novo.' }, { status: 400 });
    if (Date.now() > v.expires) return NextResponse.json({ ok: false, error: 'Código expirado. Envie um novo.' }, { status: 400 });
    if ((v.attempts || 0) >= 5) return NextResponse.json({ ok: false, error: 'Muitas tentativas. Envie um novo código.' }, { status: 429 });
    if (hashCode(code) !== v.hash) {
      await prisma.appSetting.update({ where: { key: keyOf(user.id) }, data: { value: { ...v, attempts: (v.attempts || 0) + 1 } } });
      return NextResponse.json({ ok: false, error: 'Código incorreto.' }, { status: 400 });
    }
    // sucesso: grava o telefone verificado e limpa o código pendente
    if (v.phone && v.phone !== dbUser.phone) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: v.phone } });
    }
    await prisma.appSetting.delete({ where: { key: keyOf(user.id) } }).catch(() => {});
    return NextResponse.json({ ok: true, verified: true });
  }

  return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
}
