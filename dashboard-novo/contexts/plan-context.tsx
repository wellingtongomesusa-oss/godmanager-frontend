'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PlanLevel } from '@/lib/plans';
import { DEFAULT_PLAN, hasPlanAccess, getMinPlanForPath } from '@/lib/plans';

const STORAGE_KEY = 'godcrm_plan';

interface PlanContextValue {
  plan: PlanLevel;
  setPlan: (p: PlanLevel) => void;
  hasAccess: (required: PlanLevel) => boolean;
  canAccessPath: (pathname: string) => boolean;
  isPlan3: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function getStoredPlan(): PlanLevel {
  if (typeof window === 'undefined') return DEFAULT_PLAN;
  const s = localStorage.getItem(STORAGE_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  if (n === 1 || n === 2 || n === 3) return n as PlanLevel;
  const env = process.env.NEXT_PUBLIC_DEFAULT_PLAN;
  const e = env ? parseInt(env, 10) : NaN;
  return e === 1 || e === 2 || e === 3 ? (e as PlanLevel) : DEFAULT_PLAN;
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<PlanLevel>(DEFAULT_PLAN);

  useEffect(() => {
    setPlanState(getStoredPlan());
  }, []);

  const setPlan = useCallback((p: PlanLevel) => {
    setPlanState(p);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(p));
    }
  }, []);

  const hasAccess = useCallback(
    (required: PlanLevel) => hasPlanAccess(plan, required),
    [plan]
  );

  const canAccessPath = useCallback(
    (pathname: string) => {
      const min = getMinPlanForPath(pathname);
      return min === 0 || plan >= min;
    },
    [plan]
  );

  const isPlan3 = plan === 3;

  const value = useMemo(
    () => ({
      plan,
      setPlan,
      hasAccess,
      canAccessPath,
      isPlan3,
    }),
    [plan, setPlan, hasAccess, canAccessPath, isPlan3]
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
