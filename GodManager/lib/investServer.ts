import { getCurrentUserFromSession } from '@/lib/authServer';

/** Resolve o cliente para as rotas de Invest (super_admin usa clientId; senão o do usuário). */
export async function resolveInvestClient(incoming?: string | null) {
  const user = await getCurrentUserFromSession();
  if (!user) return { ok: false as const, status: 401, error: 'Não autenticado.' };
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && !user.clientId) {
    return { ok: false as const, status: 400, error: 'Usuário sem cliente.' };
  }
  const cid = (incoming && String(incoming).trim()) || user.clientId || null;
  if (!cid) return { ok: false as const, status: 400, error: 'clientId requerido.' };
  return { ok: true as const, user, clientId: cid, role };
}

// Cidades/condomínios conhecidos da região (FL). Extrai a "Community" do endereço.
const FL_CITIES = [
  'Winter Garden', 'Windermere', 'Clermont', 'Kissimmee', 'Davenport', 'Orlando',
  'Saint Cloud', 'St Cloud', 'Celebration', 'Lake Wales', 'Bay Harbor Islands',
  'Ocoee', 'Groveland', 'Reunion', 'Champions Gate', 'ChampionsGate', 'Poinciana',
  'Haines City', 'Auburndale', 'Minneola', 'Apopka', 'Montverde',
];

export function communityFromAddress(addr: string): string {
  const a = String(addr || '');
  for (const c of FL_CITIES) {
    if (a.toLowerCase().includes(c.toLowerCase())) return c;
  }
  const zip = a.match(/\b(\d{5})\b/);
  return zip ? 'FL ' + zip[1] : '—';
}
