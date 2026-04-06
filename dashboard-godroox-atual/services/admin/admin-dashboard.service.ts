/**
 * Admin Dashboard Service — Dashboard Godroox (app standalone)
 * Métricas, transações e dupla alçada. Mocks; trocar por API quando houver backend.
 */

export type TransactionStatus = 'feito' | 'aguardando' | 'cancelada';
export type ApprovalStatus = 'aprovado' | 'pendente';

export type TipoDemanda =
  | 'life_insurance'
  | 'llc_florida'
  | 'pagamentos_internacionais'
  | 'godroox_pro';

export const TIPO_DEMANDA_LABELS: Record<TipoDemanda, string> = {
  life_insurance: 'Life Insurance',
  llc_florida: 'Abertura de LLC na Flórida',
  pagamentos_internacionais: 'Pagamentos internacionais Brasil ↔ EUA',
  godroox_pro: 'Godroox PRO (ações e opções)',
};

export interface Transaction {
  id: string;
  cliente: string;
  tipoDemanda: TipoDemanda;
  data: string;
  valor: number | null;
  moeda: string;
  paisOrigem: string | null;
  paisDestino: string | null;
  status: TransactionStatus;
  statusAprovador1: ApprovalStatus;
  statusAprovador2: ApprovalStatus;
}

export interface AdminMetrics {
  contasCadastradas: number;
  transacoesTotais: number;
  transacoesConcluidas: number;
  transacoesPendentes: number;
  transacoesCanceladas: number;
}

export interface TransactionFilters {
  status?: TransactionStatus | '';
  tipoDemanda?: TipoDemanda | '';
  pais?: string;
  dataInicio?: string;
  dataFim?: string;
}

const MOCK_CONTAS = 127;
let mockTransactions: Transaction[] = [
  { id: 'tx-1', cliente: 'Maria Silva', tipoDemanda: 'life_insurance', data: '2025-01-18', valor: 45000, moeda: 'USD', paisOrigem: 'BR', paisDestino: 'US', status: 'aguardando', statusAprovador1: 'aprovado', statusAprovador2: 'pendente' },
  { id: 'tx-2', cliente: 'John Doe', tipoDemanda: 'llc_florida', data: '2025-01-17', valor: 2500, moeda: 'USD', paisOrigem: 'US', paisDestino: null, status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' },
  { id: 'tx-3', cliente: 'Ana Costa', tipoDemanda: 'pagamentos_internacionais', data: '2025-01-20', valor: 15000, moeda: 'BRL', paisOrigem: 'BR', paisDestino: 'US', status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-4', cliente: 'Carlos Mendes', tipoDemanda: 'godroox_pro', data: '2025-01-15', valor: null, moeda: 'USD', paisOrigem: 'BR', paisDestino: null, status: 'cancelada', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-5', cliente: 'Patricia Lima', tipoDemanda: 'pagamentos_internacionais', data: '2025-01-22', valor: 8000, moeda: 'USD', paisOrigem: 'US', paisDestino: 'BR', status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-6', cliente: 'Roberto Santos', tipoDemanda: 'life_insurance', data: '2025-01-10', valor: 60000, moeda: 'USD', paisOrigem: 'US', paisDestino: null, status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' },
];

function computeStatus(a1: ApprovalStatus, a2: ApprovalStatus, cur: TransactionStatus): TransactionStatus {
  if (cur === 'cancelada') return 'cancelada';
  if (a1 === 'aprovado' && a2 === 'aprovado') return 'feito';
  return 'aguardando';
}

export function getMetrics(): AdminMetrics {
  const list = [...mockTransactions];
  return {
    contasCadastradas: MOCK_CONTAS,
    transacoesTotais: list.length,
    transacoesConcluidas: list.filter((t) => t.status === 'feito').length,
    transacoesPendentes: list.filter((t) => t.status === 'aguardando').length,
    transacoesCanceladas: list.filter((t) => t.status === 'cancelada').length,
  };
}

export function getTransactions(filters: TransactionFilters = {}): Transaction[] {
  let list = [...mockTransactions];
  if (filters.status) list = list.filter((t) => t.status === filters.status);
  if (filters.tipoDemanda) list = list.filter((t) => t.tipoDemanda === filters.tipoDemanda);
  if (filters.pais) list = list.filter((t) => t.paisOrigem === filters.pais || t.paisDestino === filters.pais);
  if (filters.dataInicio) list = list.filter((t) => t.data >= (filters.dataInicio ?? ''));
  if (filters.dataFim) list = list.filter((t) => t.data <= (filters.dataFim ?? ''));
  return list.sort((a, b) => (b.data > a.data ? 1 : -1));
}

export function setTransactionStatus(id: string, status: TransactionStatus): Transaction | null {
  const i = mockTransactions.findIndex((t) => t.id === id);
  if (i < 0) return null;
  if (status === 'cancelada') {
    mockTransactions[i] = { ...mockTransactions[i], status: 'cancelada', statusAprovador1: 'pendente', statusAprovador2: 'pendente' };
    return mockTransactions[i];
  }
  if (status === 'aguardando') {
    mockTransactions[i] = { ...mockTransactions[i], status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' };
    return mockTransactions[i];
  }
  mockTransactions[i] = { ...mockTransactions[i], status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' };
  return mockTransactions[i];
}

export function approveStep1(id: string): Transaction | null {
  const i = mockTransactions.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const t = mockTransactions[i];
  if (t.status === 'cancelada') return t;
  mockTransactions[i] = { ...t, statusAprovador1: 'aprovado', status: computeStatus('aprovado', t.statusAprovador2, t.status) };
  return mockTransactions[i];
}

export function approveStep2(id: string): Transaction | null {
  const i = mockTransactions.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const t = mockTransactions[i];
  if (t.status === 'cancelada') return t;
  mockTransactions[i] = { ...t, statusAprovador2: 'aprovado', status: computeStatus(t.statusAprovador1, 'aprovado', t.status) };
  return mockTransactions[i];
}

export function getApprovalDisplayLabel(t: Transaction): string {
  if (t.status === 'cancelada') return 'Cancelada';
  if (t.status === 'feito') return 'Aprovado (Feito)';
  if (t.statusAprovador1 === 'pendente') return 'Aguardando 1ª aprovação';
  if (t.statusAprovador2 === 'pendente') return 'Aguardando 2ª aprovação';
  return 'Aprovado (Feito)';
}
