'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-secondary-900">Erro ao carregar Invoices</h2>
      <p className="text-sm text-secondary-600 text-center max-w-md">
        Ocorreu um problema. Tente novamente ou volte ao painel.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Link href="/admin/painel">
          <Button variant="outline">Voltar ao Painel</Button>
        </Link>
      </div>
    </div>
  );
}
