import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Verifique o endereço ou volte ao início. O app corre em{' '}
        <strong>http://localhost:3101</strong> (porta padrão deste projeto).
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Início
        </Link>
        <Link
          href="/manager-pro/login"
          className="rounded-xl border-2 border-amber-600 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Login manager-pro
        </Link>
      </div>
    </main>
  );
}
