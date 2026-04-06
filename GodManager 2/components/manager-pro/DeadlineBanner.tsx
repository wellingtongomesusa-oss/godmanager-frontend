'use client';

import { useEffect, useState } from 'react';

const DEADLINE_MS = new Date(2026, 2, 30, 0, 0, 0, 0).getTime();

type Props = {
  proposalUrl?: string;
};

function formatRemaining(ms: number): { days: number; hours: number; minutes: number } {
  const totalM = Math.floor(ms / 60000);
  const days = Math.floor(totalM / (60 * 24));
  const hours = Math.floor((totalM % (60 * 24)) / 60);
  const minutes = totalM % 60;
  return { days, hours, minutes };
}

export function DeadlineBanner({ proposalUrl = '#' }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (hidden || now >= DEADLINE_MS) return null;

  const left = DEADLINE_MS - now;
  const { days, hours, minutes } = formatRemaining(left);

  return (
    <div className="border-b border-amber-700/50 bg-gradient-to-r from-amber-950 via-[#1a1510] to-amber-950 px-4 py-3 text-center text-sm text-amber-50 shadow-md">
      <span className="font-semibold">Proposta GodManager Trust — enviar até 30/03/2026</span>
      <span className="mx-2 text-amber-200/90">·</span>
      <span className="tabular-nums text-amber-100">
        Faltam {days}d {hours}h {minutes}m
      </span>
      <a
        href={proposalUrl}
        className="ml-4 inline-flex rounded-lg bg-[var(--amber)] px-4 py-1.5 text-xs font-bold text-white hover:opacity-95"
      >
        Abrir Proposta
      </a>
      <button
        type="button"
        className="ml-3 text-[10px] text-amber-200/70 underline hover:text-amber-100"
        onClick={() => setHidden(true)}
      >
        Ocultar
      </button>
    </div>
  );
}
