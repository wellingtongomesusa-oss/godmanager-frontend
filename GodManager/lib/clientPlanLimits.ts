import type { ClientPlan } from '@prisma/client';

/** Limites de utilizadores ativos por plano (alinhado com GodManager_Premium.html getMaxUsers). */
export function getMaxUsersForClientPlan(plan: ClientPlan | string | null | undefined): number {
  const p = String(plan || 'professional').toLowerCase();
  if (p === 'starter') return 2;
  if (p === 'enterprise') return 11;
  return 4;
}

export function clientPlanLabelPt(plan: string | null | undefined): string {
  const v = String(plan || 'professional').toLowerCase();
  if (v === 'starter') return 'Starter';
  if (v === 'enterprise') return 'Enterprise';
  return 'Professional';
}
