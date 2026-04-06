'use client';

import { createContext, useContext } from 'react';
import type { MasterOneLocale } from '@/lib/manager-pro/masterOneLocale';

export const MasterOneLocaleContext = createContext<MasterOneLocale>('pt');

export function useMasterOneLocale(): MasterOneLocale {
  return useContext(MasterOneLocaleContext);
}
