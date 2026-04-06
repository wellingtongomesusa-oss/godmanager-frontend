'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Erro crítico</h2>
          <p className="text-sm text-gray-600 text-center max-w-md">
            Ocorreu um erro inesperado. Recarregue a página para tentar novamente.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
