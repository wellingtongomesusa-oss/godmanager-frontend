import type { ClientProductType } from '@prisma/client';
import { getGodManagerPremiumUrl } from '@/lib/godmanager-premium-url';

/**
 * Mapa central: ClientProductType → URL pós-login.
 * Para adicionar um novo vertical de produto:
 *   1) Adicionar valor ao enum ClientProductType em schema.prisma + migration
 *   2) Criar rota em app/<slug>/
 *   3) Adicionar entrada aqui
 */
export function getPostLoginUrlForProductType(
  productType: ClientProductType | null | undefined,
): string {
  switch (productType) {
    case 'DESIGN_DECORATION':
      return '/design';
    case 'EXPENSES_JOBS':
      return getGodManagerPremiumUrl();
    // Futuros verticais entram aqui:
    // case 'HOSPITALITY':       return '/hospitality';
    // case 'CONSTRUCTION':      return '/construction';
    // case 'CLEANING_COMPANY':  return '/cleaning';
    case 'PROPERTY_MANAGEMENT':
    default:
      return getGodManagerPremiumUrl();
  }
}
