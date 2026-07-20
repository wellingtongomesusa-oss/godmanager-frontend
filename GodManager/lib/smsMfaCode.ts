import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendSms, twilioConfigured } from '@/lib/twilioSms';

/**
 * Código de verificação por SMS (6 dígitos) — compartilhado entre o fluxo de login (2º fator)
 * e a verificação de telefone dentro do app. Guarda no AppSetting (sem migration), com hash,
 * expiração de 5 min, limite de tentativas e rate limit de reenvio. Totalmente env-gated no Twilio.
 */

const keyOf = (uid: string) => `sms_mfa:${uid}`;
const hashCode = (c: string) => crypto.createHash('sha256').update('gm-sms:' + c).digest('hex');
export const normPhone = (p: string) => String(p || '').replace(/[\s()-]/g, '');

export type SmsCodeRec = {
  hash: string;
  expires: number;
  attempts: number;
  lastSent: number;
  phone: string;
};

const maskPhone = (p: string) => p.replace(/.(?=.{4})/g, '*');

/** Gera, guarda e envia um código por SMS. Não lança; retorna status HTTP sugerido em falha. */
export async function issueSmsCode(
  userId: string,
  phoneRaw: string,
): Promise<{ ok: boolean; error?: string; status?: number; to?: string }> {
  if (!twilioConfigured()) return { ok: false, error: 'not_configured', status: 503 };
  const phone = normPhone(phoneRaw);
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return { ok: false, error: 'invalid_phone', status: 400 };

  const existing = await prisma.appSetting.findUnique({ where: { key: keyOf(userId) } });
  const prev = (existing?.value as SmsCodeRec | null) || null;
  if (prev?.lastSent && Date.now() - prev.lastSent < 30_000) {
    return { ok: false, error: 'rate_limited', status: 429 };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const rec: SmsCodeRec = {
    hash: hashCode(code),
    expires: Date.now() + 5 * 60_000,
    attempts: 0,
    lastSent: Date.now(),
    phone,
  };
  await prisma.appSetting.upsert({
    where: { key: keyOf(userId) },
    create: { key: keyOf(userId), value: rec, updatedBy: userId },
    update: { value: rec, updatedBy: userId },
  });

  const r = await sendSms(phone, `GodManager: seu código de verificação é ${code}. Expira em 5 minutos.`);
  if (!r.ok) return { ok: false, error: r.error || 'sms_failed', status: 502 };
  return { ok: true, to: maskPhone(phone) };
}

/** Verifica o código pendente. Em sucesso, consome o código e devolve o telefone verificado. */
export async function verifySmsCode(
  userId: string,
  codeRaw: string,
): Promise<{ ok: boolean; error?: string; status?: number; phone?: string }> {
  const code = String(codeRaw || '').trim();
  const rec = await prisma.appSetting.findUnique({ where: { key: keyOf(userId) } });
  const v = (rec?.value as SmsCodeRec | null) || null;
  if (!v?.hash || !v?.expires) return { ok: false, error: 'no_pending', status: 400 };
  if (Date.now() > v.expires) return { ok: false, error: 'expired', status: 400 };
  if ((v.attempts || 0) >= 5) return { ok: false, error: 'too_many', status: 429 };
  if (hashCode(code) !== v.hash) {
    await prisma.appSetting.update({
      where: { key: keyOf(userId) },
      data: { value: { ...v, attempts: (v.attempts || 0) + 1 } },
    });
    return { ok: false, error: 'incorrect', status: 400 };
  }
  await prisma.appSetting.delete({ where: { key: keyOf(userId) } }).catch(() => {});
  return { ok: true, phone: v.phone };
}

/** Mensagem PT amigável para os códigos de erro do verify. */
export function smsErrorPt(code?: string): string {
  switch (code) {
    case 'no_pending':
      return 'Nenhum código pendente. Reenvie o SMS.';
    case 'expired':
      return 'Código expirado. Reenvie o SMS.';
    case 'too_many':
      return 'Muitas tentativas. Reenvie um novo código.';
    case 'incorrect':
      return 'Código incorreto.';
    case 'rate_limited':
      return 'Aguarde alguns segundos antes de reenviar.';
    case 'invalid_phone':
      return 'Telefone inválido no cadastro. Contate o administrador.';
    case 'sms_failed':
    case 'not_configured':
      return 'Não foi possível enviar o SMS agora. Tente novamente.';
    default:
      return 'Falha na verificação por SMS.';
  }
}
