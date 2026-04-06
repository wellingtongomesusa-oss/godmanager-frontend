'use client';

import Link from 'next/link';

export default function LicensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
      <h2 className="text-lg font-bold">Erro ao carregar Licenças</h2>
      <p className="mt-2 text-sm">{error.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white"
        >
          Tentar outra vez
        </button>
        <Link href="/manager-pro" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
