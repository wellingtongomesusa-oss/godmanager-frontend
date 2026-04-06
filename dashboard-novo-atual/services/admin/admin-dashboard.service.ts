/**
 * Admin Dashboard Service – Dashboard Novo
 * Métricas, transações, dupla alçada, Add+ (novas demandas).
 * Usa mocks; pode ser trocado por API depois.
 */

export type TransactionStatus = 'feito' | 'aguardando' | 'cancelada';
export type ApprovalStatus = 'aprovado' | 'pendente';

export type TipoDemanda =
  | 'life_insurance'
  | 'llc_florida'
  | 'pagamentos_internacionais'
  | 'godroox_pro'
  | 'gpainel'
  | 'gopen'
  | 'gpay'
  | 'gpro'
  | 'gmail'
  | 'glife';

export const TIPO_DEMANDA_LABELS: Record<TipoDemanda, string> = {
  life_insurance: 'Life Insurance',
  llc_florida: 'Abertura de LLC na Flórida',
  pagamentos_internacionais: 'Pagamentos internacionais Brasil ↔ EUA',
  godroox_pro: 'Godroox PRO (ações e opções)',
  gpainel: 'Godroox Painel',
  gopen: 'Godroox Open',
  gpay: 'Godroox Pay',
  gpro: 'Godroox PRO',
  gmail: 'Godroox Mail',
  glife: 'Life Insurance',
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
  descricaoProblema?: string;
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

export type AddDemandInput = {
  tipoDemanda: TipoDemanda;
  data: string;
  quemPediu: string;
  descricaoProblema?: string;
};

export type ApprovalDisplayKey =
  | 'table.approval.cancelada'
  | 'table.approval.done'
  | 'table.approval.wait1'
  | 'table.approval.wait2';

const MOCK_CONTAS_CADASTRADAS = 127;

let mockTransactions: Transaction[] = [
  { id: 'tx-1', cliente: 'Maria Silva', tipoDemanda: 'life_insurance', data: '2025-01-18', valor: 45000, moeda: 'USD', paisOrigem: 'BR', paisDestino: 'US', status: 'aguardando', statusAprovador1: 'aprovado', statusAprovador2: 'pendente' },
  { id: 'tx-2', cliente: 'John Doe', tipoDemanda: 'llc_florida', data: '2025-01-17', valor: 2500, moeda: 'USD', paisOrigem: 'US', paisDestino: null, status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' },
  { id: 'tx-3', cliente: 'Ana Costa', tipoDemanda: 'pagamentos_internacionais', data: '2025-01-20', valor: 15000, moeda: 'BRL', paisOrigem: 'BR', paisDestino: 'US', status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-4', cliente: 'Carlos Mendes', tipoDemanda: 'godroox_pro', data: '2025-01-15', valor: null, moeda: 'USD', paisOrigem: 'BR', paisDestino: null, status: 'cancelada', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-5', cliente: 'Patricia Lima', tipoDemanda: 'pagamentos_internacionais', data: '2025-01-22', valor: 8000, moeda: 'USD', paisOrigem: 'US', paisDestino: 'BR', status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' },
  { id: 'tx-6', cliente: 'Roberto Santos', tipoDemanda: 'life_insurance', data: '2025-01-10', valor: 60000, moeda: 'USD', paisOrigem: 'US', paisDestino: null, status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' },
];

function computeStatusFromApprovals(
  a1: ApprovalStatus,
  a2: ApprovalStatus,
  current: TransactionStatus
): TransactionStatus {
  if (current === 'cancelada') return 'cancelada';
  if (a1 === 'aprovado' && a2 === 'aprovado') return 'feito';
  return 'aguardando';
}

function getTransactionsInternal(): Transaction[] {
  return [...mockTransactions];
}

export function getMetrics(): AdminMetrics {
  const tx = getTransactionsInternal();
  return {
    contasCadastradas: MOCK_CONTAS_CADASTRADAS,
    transacoesTotais: tx.length,
    transacoesConcluidas: tx.filter((t) => t.status === 'feito').length,
    transacoesPendentes: tx.filter((t) => t.status === 'aguardando').length,
    transacoesCanceladas: tx.filter((t) => t.status === 'cancelada').length,
  };
}

export function getTransactions(filters: TransactionFilters = {}): Transaction[] {
  let list = getTransactionsInternal();
  if (filters.status) list = list.filter((t) => t.status === filters.status);
  if (filters.tipoDemanda) list = list.filter((t) => t.tipoDemanda === filters.tipoDemanda);
  if (filters.pais) list = list.filter((t) => t.paisOrigem === filters.pais || t.paisDestino === filters.pais);
  if (filters.dataInicio) list = list.filter((t) => t.data >= (filters.dataInicio ?? ''));
  if (filters.dataFim) list = list.filter((t) => t.data <= (filters.dataFim ?? ''));
  return list.sort((a, b) => (b.data > a.data ? 1 : -1));
}

export function addTransaction(input: AddDemandInput): Transaction {
  const t: Transaction = {
    id: `tx-${Date.now()}`,
    cliente: input.quemPediu,
    tipoDemanda: input.tipoDemanda,
    data: input.data,
    valor: null,
    moeda: 'USD',
    paisOrigem: null,
    paisDestino: null,
    status: 'aguardando',
    statusAprovador1: 'pendente',
    statusAprovador2: 'pendente',
    ...(input.descricaoProblema != null && input.descricaoProblema.trim() !== '' && { descricaoProblema: input.descricaoProblema.trim() }),
  };
  mockTransactions.unshift(t);
  return t;
}

export function setTransactionStatus(id: string, status: TransactionStatus): Transaction | null {
  const idx = mockTransactions.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  if (status === 'cancelada') {
    mockTransactions[idx] = { ...mockTransactions[idx], status: 'cancelada', statusAprovador1: 'pendente', statusAprovador2: 'pendente' };
    return mockTransactions[idx];
  }
  if (status === 'aguardando') {
    mockTransactions[idx] = { ...mockTransactions[idx], status: 'aguardando', statusAprovador1: 'pendente', statusAprovador2: 'pendente' };
    return mockTransactions[idx];
  }
  mockTransactions[idx] = { ...mockTransactions[idx], status: 'feito', statusAprovador1: 'aprovado', statusAprovador2: 'aprovado' };
  return mockTransactions[idx];
}

export function approveStep1(id: string): Transaction | null {
  const idx = mockTransactions.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const t = mockTransactions[idx];
  if (t.status === 'cancelada') return t;
  mockTransactions[idx] = {
    ...t,
    statusAprovador1: 'aprovado',
    status: computeStatusFromApprovals('aprovado', t.statusAprovador2, t.status),
  };
  return mockTransactions[idx];
}

export function approveStep2(id: string): Transaction | null {
  const idx = mockTransactions.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const t = mockTransactions[idx];
  if (t.status === 'cancelada') return t;
  mockTransactions[idx] = {
    ...t,
    statusAprovador2: 'aprovado',
    status: computeStatusFromApprovals(t.statusAprovador1, 'aprovado', t.status),
  };
  return mockTransactions[idx];
}

export function getApprovalDisplayLabel(t: Transaction): string {
  if (t.status === 'cancelada') return 'Cancelada';
  if (t.status === 'feito') return 'Aprovado (Feito)';
  if (t.statusAprovador1 === 'pendente') return 'Aguardando 1ª aprovação';
  if (t.statusAprovador2 === 'pendente') return 'Aguardando 2ª aprovação';
  return 'Aprovado (Feito)';
}

export function getApprovalDisplayKey(t: Transaction): ApprovalDisplayKey {
  if (t.status === 'cancelada') return 'table.approval.cancelada';
  if (t.status === 'feito') return 'table.approval.done';
  if (t.statusAprovador1 === 'pendente') return 'table.approval.wait1';
  if (t.statusAprovador2 === 'pendente') return 'table.approval.wait2';
  return 'table.approval.done';
}

export interface DashboardKpiItem {
  label: string;
  labelKey?: 'kpi.clientes' | 'kpi.pedidos' | 'kpi.concluidos' | 'kpi.pendentes' | 'kpi.cancelados';
  value: number | string;
  changePercent: number;
  colorScope: 'blue' | 'orange' | 'gray' | 'yellow' | 'green';
}

export function getDashboardKpis(metrics: AdminMetrics): DashboardKpiItem[] {
  return [
    { label: 'Clientes', labelKey: 'kpi.clientes', value: metrics.contasCadastradas, changePercent: 5.27, colorScope: 'blue' },
    { label: 'Pedidos', labelKey: 'kpi.pedidos', value: metrics.transacoesTotais, changePercent: -1.08, colorScope: 'orange' },
    { label: 'Concluídos', labelKey: 'kpi.concluidos', value: metrics.transacoesConcluidas, changePercent: -7.0, colorScope: 'gray' },
    { label: 'Pendentes', labelKey: 'kpi.pendentes', value: metrics.transacoesPendentes, changePercent: 4.87, colorScope: 'yellow' },
    { label: 'Cancelados', labelKey: 'kpi.cancelados', value: metrics.transacoesCanceladas, changePercent: 1.2, colorScope: 'green' },
  ];
}

export interface ProjecaoMesItem {
  month: string;
  atual: number;
  projecao: number;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function getProjecoesAtuaisData(): ProjecaoMesItem[] {
  const base = [40, 55, 70, 65, 90, 120, 100, 95, 110, 85, 75, 60];
  return MESES.map((month, i) => ({
    month,
    atual: base[i]! * 0.7 + Math.floor(Math.random() * 20),
    projecao: base[i]! * 1.1 + Math.floor(Math.random() * 15),
  }));
}

export interface FaturamentoPoint {
  label: string;
  atual: number;
  anterior: number;
}

export function getFaturamentoData(): FaturamentoPoint[] {
  return [
    { label: 'Set', atual: 2.2, anterior: 2.0 },
    { label: 'Out', atual: 3.8, anterior: 2.8 },
    { label: 'Nov', atual: 2.5, anterior: 3.2 },
    { label: 'Dez', atual: 3.0, anterior: 2.6 },
  ].map((p) => ({ ...p, atual: p.atual * 1000, anterior: p.anterior * 1000 }));
}

export interface CategoriaItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  life_insurance: 'Life Insurance',
  llc_florida: 'LLC Flórida',
  pagamentos_internacionais: 'Pag. Internac.',
  godroox_pro: 'Godroox PRO',
  gpainel: 'Painel',
  gopen: 'Open',
  gpay: 'Pay',
  gpro: 'PRO',
  gmail: 'Mail',
  glife: 'Life',
};

export function getCategoriasData(): CategoriaItem[] {
  const tx = getTransactionsInternal();
  const byType: Record<string, number> = {};
  tx.forEach((t) => { byType[t.tipoDemanda] = (byType[t.tipoDemanda] ?? 0) + 1; });
  const total = tx.length || 1;
  const colors = ['#3b82f6', '#f97316', '#78716c', '#eab308', '#22c55e'];
  return Object.entries(byType).map(([key, value], i) => ({
    name: CATEGORIA_LABELS[key] ?? key,
    value,
    percent: Math.round((value / total) * 100),
    color: colors[i % colors.length]!,
  }));
}
