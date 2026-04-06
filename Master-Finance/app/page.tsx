import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6">
      <div className="max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Novo projeto
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
          Master Finance
        </h1>
        <p className="mt-4 text-slate-600">
          Pasta do projeto: <code className="rounded bg-slate-100 px-2 py-0.5 text-sm">Master-Finance</code>
          <br />
          Pacote npm: <code className="rounded bg-slate-100 px-2 py-0.5 text-sm">master-finance</code>
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Servidor de desenvolvimento na porta <strong>3000</strong> (<code>npm run dev</code>).
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="http://localhost:3000"
            className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            http://localhost:3000
          </a>
        </div>
        <p className="mt-10 text-xs text-slate-400">
          Suite completa <strong>GodManager.One</strong> continua em{" "}
          <Link href="http://localhost:3101" className="font-medium text-emerald-700 underline">
            GodManager
          </Link>{" "}
          (outro projeto).
        </p>
      </div>
    </main>
  );
}
