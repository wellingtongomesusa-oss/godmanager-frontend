/**
 * Ramp — cartões corporativos (OAuth). Variáveis: RAMP_CLIENT_ID, RAMP_CLIENT_SECRET
 */

export type RampTransaction = {
  id: string;
  comerciante: string;
  valor: number;
  data: string;
  cartaoId: string;
};

export type RampCard = {
  id: string;
  ultimos4: string;
  titular: string;
  ativo: boolean;
};

export type RampDepartment = {
  id: string;
  nome: string;
  gastoMes: number;
};

const DEMO_TX: RampTransaction[] = [
  { id: 'rt-1', comerciante: 'Amazon Business', valor: 412.5, data: '2026-03-27', cartaoId: 'c1' },
  { id: 'rt-2', comerciante: 'The Home Depot', valor: 128.2, data: '2026-03-26', cartaoId: 'c1' },
];

const DEMO_CARDS: RampCard[] = [
  { id: 'c1', ultimos4: '4821', titular: 'HOPM Ops', ativo: true },
  { id: 'c2', ultimos4: '9012', titular: 'HOPM Field', ativo: true },
];

const DEMO_DEPT: RampDepartment[] = [
  { id: 'd1', nome: 'Operações', gastoMes: 12400 },
  { id: 'd2', nome: 'Manutenção', gastoMes: 8200 },
];

export function getRampAuthorizeUrl(): string {
  if (typeof window === 'undefined') return '/api/integrations/ramp/authorize';
  return `${window.location.origin}/api/integrations/ramp/authorize`;
}

export async function listTransactionsDemo(): Promise<RampTransaction[]> {
  await new Promise((r) => setTimeout(r, 160));
  return DEMO_TX;
}

export async function listCardsDemo(): Promise<RampCard[]> {
  await new Promise((r) => setTimeout(r, 120));
  return DEMO_CARDS;
}

export async function listDepartmentsDemo(): Promise<RampDepartment[]> {
  await new Promise((r) => setTimeout(r, 120));
  return DEMO_DEPT;
}
