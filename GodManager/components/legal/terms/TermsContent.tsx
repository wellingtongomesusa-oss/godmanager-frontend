import type { AppLocale } from '@/i18n/routing';
import { TermsContentEn } from './en';
import { TermsContentEs } from './es';
import { TermsContentPtBr } from './pt-br';

export function TermsContent({ locale }: { locale: AppLocale }) {
  if (locale === 'pt-br') return <TermsContentPtBr />;
  if (locale === 'es') return <TermsContentEs />;
  return <TermsContentEn />;
}
