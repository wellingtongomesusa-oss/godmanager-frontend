'use client';

import { LanguageProvider } from '@/contexts/language-context';
import { PlanProvider } from '@/contexts/plan-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <PlanProvider>{children}</PlanProvider>
    </LanguageProvider>
  );
}
