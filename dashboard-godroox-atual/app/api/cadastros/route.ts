import { NextResponse } from 'next/server';

/**
 * Proxy para cadastros no frontend Godroox.
 * Usa DASHBOARD_API_SECRET no servidor; o client não enxerga o segredo.
 * GET /api/cadastros
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_GODROOX_API_URL ?? process.env.GODROOX_API_URL ?? 'http://localhost:3000';
  const secret = process.env.DASHBOARD_API_SECRET ?? process.env.MASTER_PASSWORD ?? '';

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/admin/cadastros`;
  try {
    const res = await fetch(url, {
      headers: { 'X-Dashboard-Secret': secret },
      cache: 'no-store',
    });
    const data = await res.json();

    if (res.status === 401) {
      return NextResponse.json(
        { error: 'Frontend rejeitou a chave. Confira se DASHBOARD_API_SECRET no godroox (.env.local) é igual ao do dashboard.' },
        { status: 502 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg =
      process.env.NODE_ENV === 'development'
        ? 'Conecte ao frontend: rode o projeto godroox com "npm run dev" em outra aba (porta 3000) e deixe NEXT_PUBLIC_GODROOX_API_URL=http://localhost:3000 no .env.local do dashboard.'
        : 'Não foi possível conectar ao frontend. Verifique NEXT_PUBLIC_GODROOX_API_URL e se o projeto godroox está em execução.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
