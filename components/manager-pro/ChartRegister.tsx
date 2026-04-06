'use client';

import { useEffect } from 'react';

let registered = false;

/**
 * Chart.js não deve ser importado estaticamente: no SSR/isomórfico pode falhar
 * e deixar o Shell (login + painel) com ecrã em branco.
 * Registo só no browser via import dinâmico.
 */
export function ChartRegister() {
  useEffect(() => {
    if (registered) return;
    void import('chart.js').then(
      ({
        Chart,
        ArcElement,
        Tooltip,
        Legend,
        CategoryScale,
        LinearScale,
        BarElement,
        PointElement,
        LineElement,
        Filler,
        BubbleController,
      }) => {
        if (registered) return;
        Chart.register(
          ArcElement,
          Tooltip,
          Legend,
          CategoryScale,
          LinearScale,
          BarElement,
          PointElement,
          LineElement,
          Filler,
          BubbleController
        );
        registered = true;
      }
    );
  }, []);
  return null;
}
