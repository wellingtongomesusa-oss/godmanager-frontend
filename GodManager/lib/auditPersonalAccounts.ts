import { prisma } from '@/lib/db';

/**
 * Lista de contas/descrições que o cliente considera "pessoais" para a regra 1 (billback) da
 * auditoria de trust accounting. Persistida por cliente em AppSetting (Json array de strings).
 */
const keyOf = (clientId: string | null | undefined) => `audit:personalAccounts:${clientId || 'global'}`;

/** Quebra texto livre (vírgula, ponto-e-vírgula ou nova linha) em termos limpos. */
export function parsePersonalList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export async function loadPersonalAccounts(clientId: string | null | undefined): Promise<string[]> {
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: keyOf(clientId) } });
    const v = s?.value as unknown;
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

export async function savePersonalAccounts(
  clientId: string | null | undefined,
  list: string[],
): Promise<string[]> {
  const clean = Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean))).slice(0, 200);
  await prisma.appSetting.upsert({
    where: { key: keyOf(clientId) },
    create: { key: keyOf(clientId), value: clean },
    update: { value: clean },
  });
  return clean;
}

/** Combina a lista persistida com termos passados inline (dedupe, ordem estável). */
export function mergePersonalLists(persisted: string[], inline: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...persisted, ...inline]) {
    const t = String(s || '').trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
