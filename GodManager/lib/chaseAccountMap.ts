import { prisma } from '@/lib/db';

/**
 * Mapa: final da conta Chase (last4) → chave de conciliação (bankAccountKey), configurável por cliente.
 * Guardado em AppSetting `chase:accountMap:<clientId>`. Traz defaults da Manager Prop (só casam com
 * os finais dela — 6352/7236/7509 — então são inócuos para outros clientes).
 */

export const RECON_ACCOUNT_KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'] as const;
export type ReconAccountKey = (typeof RECON_ACCOUNT_KEYS)[number];

// Confirmado por Wellington (Manager Prop).
const DEFAULT_BY_LAST4: Record<string, ReconAccountKey> = {
  '6352': 'OPERATING_TRUST',
  '7236': 'TRUST_CHASE',
  '7509': 'DEPOSIT_SECURITY',
};

const keyOf = (clientId: string) => `chase:accountMap:${clientId}`;

function sanitize(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const last4 = String(k).replace(/\D/g, '').slice(-4);
      const key = String(v);
      if (last4.length === 4 && (RECON_ACCOUNT_KEYS as readonly string[]).includes(key)) out[last4] = key;
    }
  }
  return out;
}

/** Map efetivo: defaults + override salvo (override vence). */
export async function loadChaseMap(clientId: string): Promise<Record<string, string>> {
  const merged: Record<string, string> = { ...DEFAULT_BY_LAST4 };
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: keyOf(clientId) } });
    Object.assign(merged, sanitize(s?.value));
  } catch {
    /* usa só defaults */
  }
  return merged;
}

/** Salva/atualiza o override do cliente (merge com o já salvo). */
export async function saveChaseMap(clientId: string, map: Record<string, string>): Promise<Record<string, string>> {
  const clean = sanitize(map);
  const existing = await prisma.appSetting.findUnique({ where: { key: keyOf(clientId) } });
  const merged = { ...sanitize(existing?.value), ...clean };
  await prisma.appSetting.upsert({
    where: { key: keyOf(clientId) },
    create: { key: keyOf(clientId), value: merged },
    update: { value: merged },
  });
  return merged;
}
