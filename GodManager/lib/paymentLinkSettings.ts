import { prisma } from '@/lib/db';

export const STRIPE_FALLBACK_KEY = 'payment_link_stripe_enabled';

/**
 * O fallback de cobrança por Stripe (quando o QuickBooks Payments não gera link) está ligado?
 * Prioridade: interruptor no banco (AppSetting, controlado pelo admin na tela) → env → padrão.
 * Padrão: LIGADO quando o Stripe está configurado (STRIPE_SECRET_KEY presente).
 */
export async function isStripeFallbackEnabled(): Promise<boolean> {
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: STRIPE_FALLBACK_KEY } });
    if (s) {
      if (typeof s.value === 'boolean') return s.value;
      const v = String(s.value).toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
  } catch {
    /* sem banco: cai no env/padrão */
  }
  const env = String(process.env.PAYMENT_LINK_STRIPE_ENABLED || '').toLowerCase();
  if (env === 'true') return true;
  if (env === 'false') return false;
  return !!process.env.STRIPE_SECRET_KEY;
}
