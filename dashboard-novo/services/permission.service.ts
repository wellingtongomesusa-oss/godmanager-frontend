/**
 * PermissionService – RBAC centralizado para controle de acesso por plano.
 * Valida permissões do menu e rotas com base no plano contratado.
 */

import type { PlanLevel } from '@/lib/plans';
import type { MenuItem } from '@/lib/menu-config';
import { getMenuItemsForPlan } from '@/lib/menu-config';
import { getMinPlanForPath, hasPlanAccess } from '@/lib/plans';

export interface PermissionResult {
  allowed: boolean;
  requiredPlan?: PlanLevel;
  reason?: string;
}

export interface MenuPermissions {
  items: MenuItem[];
  canAccessCadastroDropdown: boolean;
  canCreateDepartments: boolean;
}

/**
 * Retorna as permissões do menu para o plano atual.
 * Plano 1: apenas Painel, Cadastro, Novos Projetos
 * Plano 2: Plan 1 + Invoice, Juros, Calc, Bills, GAAP, Reports, 1099
 * Plano 3: todos os itens + Cadastro vira dropdown de departamentos
 */
export function getMenuPermissions(plan: PlanLevel): MenuPermissions {
  const items = getMenuItemsForPlan(plan);
  return {
    items,
    canAccessCadastroDropdown: plan >= 3,
    canCreateDepartments: plan >= 3,
  };
}

/**
 * Verifica se o usuário pode acessar uma rota específica.
 */
export function canAccessPath(pathname: string, plan: PlanLevel): PermissionResult {
  const minPlan = getMinPlanForPath(pathname);
  if (minPlan === 0) return { allowed: true };
  const allowed = plan >= minPlan;
  return {
    allowed,
    requiredPlan: minPlan as PlanLevel,
    reason: allowed ? undefined : `Plano mínimo necessário: ${minPlan}`,
  };
}

/**
 * Verifica se o usuário tem acesso ao recurso pelo plano mínimo.
 */
export function hasResourceAccess(plan: PlanLevel, requiredPlan: PlanLevel): boolean {
  return hasPlanAccess(plan, requiredPlan);
}

/**
 * Verifica se o usuário pode acessar um departamento específico.
 * (Mock: por padrão todos com Plano 3 podem; integrar com backend depois)
 */
export function canAccessDepartment(
  plan: PlanLevel,
  _departmentId: string,
  _userDepartments?: string[]
): boolean {
  if (plan < 3) return false;
  // Se userDepartments for fornecido, validar se o usuário pertence ao depto
  if (_userDepartments && _userDepartments.length > 0) {
    return _userDepartments.includes(_departmentId);
  }
  return true;
}
