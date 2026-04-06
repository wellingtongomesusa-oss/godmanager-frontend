/**
 * Boom — pagamentos (BOOM_API_KEY, BOOM_API_SECRET).
 */

export type BoomPaymentStatus = 'pendente' | 'processado' | 'falhou';

export type BoomPayment = {
  id: string;
  valor: number;
  unidade: string;
  status: BoomPaymentStatus;
  criadoEm: string;
};

export type BoomPayout = {
  id: string;
  periodo: string;
  total: number;
};

const DEMO: BoomPayment[] = [
  { id: 'bp-1', valor: 4200, unidade: '4512 Storey Lake', status: 'pendente', criadoEm: '2026-03-28T10:00:00Z' },
  { id: 'bp-2', valor: 3600, unidade: '8820 CG', status: 'processado', criadoEm: '2026-03-25T14:20:00Z' },
  { id: 'bp-3', valor: 900, unidade: '1209 Windsor', status: 'falhou', criadoEm: '2026-03-22T09:00:00Z' },
];

export async function listPaymentsDemo(): Promise<BoomPayment[]> {
  await new Promise((r) => setTimeout(r, 180));
  return DEMO;
}

export async function getPaymentDemo(id: string): Promise<BoomPayment | null> {
  await new Promise((r) => setTimeout(r, 100));
  return DEMO.find((p) => p.id === id) ?? null;
}

export async function listPayoutsDemo(): Promise<BoomPayout[]> {
  await new Promise((r) => setTimeout(r, 140));
  return [{ id: 'po-1', periodo: '2026-03', total: 128400 }];
}

export async function postPaymentDemo(payload: {
  valor: number;
  unidade: string;
}): Promise<{ id: string; status: BoomPaymentStatus }> {
  void payload;
  await new Promise((r) => setTimeout(r, 240));
  return { id: `bp-${Date.now()}`, status: 'pendente' };
}
