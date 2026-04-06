'use client';

import { useEffect } from 'react';

/**
 * Limite de erros do segmento raiz (App Router).
 * Evita o fallback genérico "missing required error components" do Next em dev.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GodManager.One]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Erro ao carregar a página</h1>
      <p className="max-w-md text-sm text-slate-600">
        {error.message || 'Ocorreu um erro inesperado.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Tentar de novo
        </button>
        <a
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          Ir ao início
        </a>
      </div>
      <p className="mt-4 max-w-lg text-xs text-slate-500">
        Se isto repetir: no terminal, na pasta <code className="rounded bg-slate-200 px-1">GodManager</code>, execute{' '}
        <code className="rounded bg-slate-200 px-1">rm -rf .next && npm run dev</code> e abra{' '}
        <code className="rounded bg-slate-200 px-1">http://localhost:3101</code>.
      </p>
    </div>
  );
}
