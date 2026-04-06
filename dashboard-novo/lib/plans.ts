/**
 * Planos e permissões – dashboard-novo (GodCRM)
 * RBAC: plan_1 (Básico), plan_2 (Intermediário), plan_3 (Avançado/Premium)
 */

export type PlanLevel = 1 | 2 | 3;

export const PLAN_NAMES: Record<PlanLevel, string> = {
  1: 'Plano 1 – Básico',
  2: 'Plano 2 – Intermediário',
  3: 'Plano 3 – Avançado / Premium',
};

export const PLAN_SHORT: Record<PlanLevel, string> = {
  1: 'Plano 1',
  2: 'Plano 2',
  3: 'Plano 3',
};

/** Recursos por plano. */
export function hasPlanAccess(userPlan: PlanLevel, required: PlanLevel): boolean {
  return userPlan >= required;
}

/**
 * Rotas e plano mínimo exigido.
 * Alinhado ao menu: Plano 1 = 3 itens; Plano 2 = mais 7; Plano 3 = todos.
 */
export const ROUTE_MIN_PLAN: Record<string, PlanLevel | 0> = {
  '/admin/painel': 1,
  '/admin/dashboard': 1,
  '/admin/cadastro': 1,
  '/admin/open': 1,
  '/admin/projeto': 1,
  '/admin/invoices': 1,
  '/admin/invoice': 1,
  '/admin/juros-compostos': 2,
  '/admin/bills': 2,
  '/admin/bill': 2,
  '/admin/1099': 2,
  '/admin/gaap': 2,
  '/admin/reports': 2,
  '/admin/tax': 3,
  '/admin/automation': 3,
  '/admin/email': 3,
  '/admin/caixa-email': 3,
  '/admin/payments': 3,
  '/admin/payout': 3,
  '/admin/andamento': 3,
  '/admin/departamentos': 3,
};

export function getMinPlanForPath(pathname: string): PlanLevel | 0 {
  const normalized = pathname.replace(/\/$/, '') || '/';
  for (const [prefix, min] of Object.entries(ROUTE_MIN_PLAN)) {
    if (normalized === prefix || normalized.startsWith(prefix + '/')) return min;
  }
  return 0;
}

export const DEFAULT_PLAN: PlanLevel = 2;
