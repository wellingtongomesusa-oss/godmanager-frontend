import { getGodManagerPremiumUrl } from '@/lib/godmanager-premium-url';

/** Valores alinhados com Client.productType (+ null para super_admin sem client ou erro defensivo). */
export type ProductType = 'PROPERTY_MANAGEMENT' | 'DESIGN_DECORATION' | 'EXPENSES_JOBS' | null;

function premiumEntry(): string {
  return getGodManagerPremiumUrl();
}

export function getPostLoginRoute(args: { role: string; productType: ProductType }): string {
  if (args.role === 'super_admin') return premiumEntry();
  switch (args.productType) {
    case 'DESIGN_DECORATION':
      return '/design';
    case 'EXPENSES_JOBS':
      return premiumEntry();
    case 'PROPERTY_MANAGEMENT':
    default:
      return premiumEntry();
  }
}
