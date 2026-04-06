'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type TrustKpisSnapshot = {
  totalUnitsManaged: number;
  occupiedUnits: number;
  vacantUnits: number;
  monthlyRevenueConsolidated: number;
  pastDueTotal: number;
  updatedAt: string;
};

const DEMO: TrustKpisSnapshot = {
  totalUnitsManaged: 90,
  occupiedUnits: 68,
  vacantUnits: 22,
  monthlyRevenueConsolidated: 160_259,
  pastDueTotal: 17_202,
  updatedAt: new Date().toISOString(),
};

/**
 * KPIs do GodManager Trust na landing. Dados mockados; substituir por fetch à API real.
 */
export function useTrustKPIs(): {
  data: TrustKpisSnapshot;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const data = useMemo((): TrustKpisSnapshot => {
    void tick;
    return {
      ...DEMO,
      updatedAt: new Date().toISOString(),
    };
  }, [tick]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 400));
      setTick((t) => t + 1);
    } catch {
      setError('Não foi possível atualizar os KPIs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
