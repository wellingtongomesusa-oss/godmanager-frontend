/**
 * Renovations — estado local (status fluxo, parcelas, timeline)
 */
export type PayFlowStatus = 'Não Iniciado' | 'Em Andamento' | 'Em Aberto' | 'Pago';

export const PAY_FLOW: PayFlowStatus[] = ['Não Iniciado', 'Em Andamento', 'Em Aberto', 'Pago'];

export function nextPayStatus(current: PayFlowStatus): PayFlowStatus {
  const i = PAY_FLOW.indexOf(current);
  const next = PAY_FLOW[(i + 1) % PAY_FLOW.length];
  return next ?? 'Não Iniciado';
}

export function mapCsvStatusToFlow(raw: string): PayFlowStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return 'Em Andamento';
  if (s.includes('pago') || s.includes('paid') || s.includes('conclu') || s.includes('complete') || s.includes('done'))
    return 'Pago';
  if (s.includes('aberto') || s.includes('open')) return 'Em Aberto';
  if (s.includes('andamento') || s.includes('progress')) return 'Em Andamento';
  if (s.includes('não') && s.includes('inici')) return 'Não Iniciado';
  return 'Em Andamento';
}

export function projectStorageId(propertyAddress: string, index: number): string {
  const key = `${propertyAddress}#${index}`.slice(0, 120);
  if (typeof window !== 'undefined' && window.btoa) {
    try {
      return window.btoa(unescape(encodeURIComponent(key))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
    } catch {
      /* fallthrough */
    }
  }
  return `p${index}_${String(propertyAddress).slice(0, 40).replace(/\W/g, '_')}`;
}

const LS_STATUS = (id: string) => `renov_status_${id}`;
const LS_INSTALL = (id: string) => `renov_installments_${id}`;
const LS_TIMELINE = (id: string) => `renov_timeline_${id}`;

export type InstallmentRow = {
  id: string;
  description: string;
  value: number;
  due_date: string;
  paid_at: string;
  status: 'Pendente' | 'Pago' | 'Atrasado';
};

export type TimelineEvent = {
  id: string;
  at: string;
  text: string;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPayStatus(id: string): PayFlowStatus | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(LS_STATUS(id));
  if (!v) return null;
  return PAY_FLOW.includes(v as PayFlowStatus) ? (v as PayFlowStatus) : null;
}

export function savePayStatus(id: string, status: PayFlowStatus) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_STATUS(id), status);
}

export function loadInstallments(id: string): InstallmentRow[] {
  if (typeof window === 'undefined') return [];
  return safeParse<InstallmentRow[]>(localStorage.getItem(LS_INSTALL(id)), []);
}

export function saveInstallments(id: string, rows: InstallmentRow[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_INSTALL(id), JSON.stringify(rows));
}

export function loadTimeline(id: string): TimelineEvent[] {
  if (typeof window === 'undefined') return [];
  return safeParse<TimelineEvent[]>(localStorage.getItem(LS_TIMELINE(id)), []);
}

export function saveTimeline(id: string, events: TimelineEvent[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_TIMELINE(id), JSON.stringify(events));
}

export function appendTimelineEvent(id: string, text: string) {
  const ev: TimelineEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    text,
  };
  const cur = loadTimeline(id);
  saveTimeline(id, [ev, ...cur]);
  return ev;
}

export function seedInstallmentsIfEmpty(
  id: string,
  total: number,
  paid: number,
  startDate: string,
  endDate: string
): InstallmentRow[] {
  const existing = loadInstallments(id);
  if (existing.length > 0) return existing;

  const n = 4;
  const each = total > 0 ? total / n : 0;
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 120 * 86400000);
  const span = Math.max(1, end.getTime() - start.getTime());

  const rows: InstallmentRow[] = [];
  let remaining = paid;
  for (let i = 0; i < n; i++) {
    const due = new Date(start.getTime() + (span * (i + 1)) / (n + 1));
    const payThis = Math.min(each, Math.max(0, remaining));
    const isPaid = payThis >= each - 0.01;
    remaining -= payThis;
    rows.push({
      id: `inst_${i}`,
      description: `Parcela ${i + 1}/${n}`,
      value: Math.round(each * 100) / 100,
      due_date: due.toISOString().slice(0, 10),
      paid_at: isPaid ? due.toISOString().slice(0, 10) : '',
      status: isPaid ? 'Pago' : 'Pendente',
    });
  }
  saveInstallments(id, rows);
  return rows;
}

/** Barras financeiras: % verde (pago), âmbar (pendente em aberto), cinza (futuro) */
export function financialBarPercents(total: number, amountPaid: number, amountDue: number) {
  const t = Math.max(total, amountPaid + amountDue, 1);
  const green = Math.min(100, (amountPaid / t) * 100);
  const amber = Math.min(100 - green, (amountDue / t) * 100);
  const gray = Math.max(0, 100 - green - amber);
  return { green, amber, gray, t };
}
