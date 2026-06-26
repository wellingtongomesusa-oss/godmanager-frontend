import type { AppLocale } from '@/i18n/routing';
import { PrivacyContentEn } from './en';
import { PrivacyContentEs } from './es';
import { PrivacyContentPtBr } from './pt-br';

export function PrivacyContent({ locale }: { locale: AppLocale }) {
  if (locale === 'pt-br') return <PrivacyContentPtBr />;
  if (locale === 'es') return <PrivacyContentEs />;
  return <PrivacyContentEn />;
}
