'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-secondary-50">
      <h2 className="text-xl font-semibold text-secondary-900">Algo deu errado</h2>
      <p className="text-sm text-secondary-600 text-center max-w-md">
        Ocorreu um erro ao carregar esta página. Tente novamente.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary-500 px-4 py-2 text-white font-medium hover:bg-primary-600 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
