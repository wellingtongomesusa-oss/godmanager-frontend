import { prisma } from '@/lib/db';

/**
 * Envio financeiro do GodManager (send-only). Statements e cobranças saem de finance@godmanager.us
 * (configurável por env) e levam CÓPIA (CC) para a empresa contratante — por padrão o e-mail do
 * próprio Client, com override opcional por AppSetting `finance:ccEmail:<clientId>`.
 *
 * Só leitura/resolução — o envio real é feito por lib/email.ts (Resend). Nunca lança.
 */

export const FINANCE_FROM_EMAIL = process.env.FINANCE_FROM_EMAIL || 'finance@godmanager.us';

const ccKeyOf = (clientId: string) => `finance:ccEmail:${clientId}`;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmails(raw: unknown): string[] {
  if (raw == null) return [];
  const parts = Array.isArray(raw) ? raw.map(String) : String(raw).split(/[\n,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const e = p.trim();
    if (!e || !EMAIL_RE.test(e) || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

/**
 * Resolve os CCs financeiros da empresa contratante deste cliente.
 * Prioridade: override em AppSetting `finance:ccEmail:<clientId>` → e-mail do Client.
 * `exclude` remove endereços já presentes no destinatário (evita CC redundante).
 */
export async function resolveFinanceCc(
  clientId: string,
  exclude: string | string[] = [],
): Promise<string[]> {
  try {
    const excludeSet = new Set(
      (Array.isArray(exclude) ? exclude : [exclude])
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean),
    );

    let list: string[] = [];
    const override = await prisma.appSetting.findUnique({ where: { key: ccKeyOf(clientId) } });
    if (override?.value != null) list = normalizeEmails(override.value);
    if (!list.length) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { email: true } });
      list = normalizeEmails(client?.email);
    }
    return list.filter((e) => !excludeSet.has(e.toLowerCase()));
  } catch (e) {
    console.error('[resolveFinanceCc]', e instanceof Error ? e.message : e);
    return [];
  }
}

/** Define/limpa o override de CC financeiro da empresa (super_admin/admin). */
export async function saveFinanceCc(clientId: string, raw: string | string[]): Promise<string[]> {
  const clean = normalizeEmails(raw);
  await prisma.appSetting.upsert({
    where: { key: ccKeyOf(clientId) },
    create: { key: ccKeyOf(clientId), value: clean },
    update: { value: clean },
  });
  return clean;
}
