import type { AppLocale } from '@/i18n/routing';
import { SecurityContentEn } from './en';
import { SecurityContentEs } from './es';
import { SecurityContentPtBr } from './pt-br';

export function SecurityContent({ locale }: { locale: AppLocale }) {
  if (locale === 'pt-br') return <SecurityContentPtBr />;
  if (locale === 'es') return <SecurityContentEs />;
  return <SecurityContentEn />;
}
