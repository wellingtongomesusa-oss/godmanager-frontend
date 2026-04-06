/**
 * Folio API — API Key (FOLIO_API_KEY). Dados demo até conectar API real.
 */

export type FolioReservation = {
  id: string;
  unidade: string;
  hospede: string;
  checkIn: string;
  checkOut: string;
  status: 'ativa' | 'futura' | 'encerrada';
};

export type FolioDetail = {
  id: string;
  cobrancas: { id: string; descricao: string; valor: number }[];
  pagamentos: { id: string; valor: number; data: string }[];
};

const DEMO_RES: FolioReservation[] = [
  {
    id: 'f-1',
    unidade: '4512 Storey Lake',
    hospede: 'Família Silva',
    checkIn: '2026-03-28',
    checkOut: '2026-04-04',
    status: 'ativa',
  },
  {
    id: 'f-2',
    unidade: '8820 Champions Gate',
    hospede: 'Grupo Lee',
    checkIn: '2026-04-01',
    checkOut: '2026-04-08',
    status: 'futura',
  },
];

export async function listReservationsDemo(): Promise<FolioReservation[]> {
  await new Promise((r) => setTimeout(r, 180));
  return DEMO_RES;
}

export async function getFolioDemo(id: string): Promise<FolioDetail | null> {
  await new Promise((r) => setTimeout(r, 120));
  if (!id) return null;
  return {
    id,
    cobrancas: [
      { id: 'c1', descricao: 'Diárias', valor: 2400 },
      { id: 'c2', descricao: 'Taxa limpeza', valor: 185 },
    ],
    pagamentos: [{ id: 'p1', valor: 2585, data: '2026-03-20' }],
  };
}

export async function postChargeDemo(
  folioId: string,
  payload: { descricao: string; valor: number },
): Promise<{ id: string }> {
  void folioId;
  await new Promise((r) => setTimeout(r, 200));
  return { id: `chg-${Date.now()}` };
}
