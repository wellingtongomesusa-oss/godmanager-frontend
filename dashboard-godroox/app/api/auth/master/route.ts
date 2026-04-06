import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida credenciais master do dashboard.
 * Usuário e senha vêm de variáveis de ambiente (nunca no client).
 * POST /api/auth/master
 * Body: { usuario: string, senha: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const usuario = (body?.usuario ?? body?.user ?? '').toString().trim();
    const senha = (body?.senha ?? body?.password ?? '').toString();

    const masterUser = process.env.MASTER_USER ?? process.env.NEXT_PUBLIC_MASTER_USER ?? 'master';
    const masterPassword = process.env.MASTER_PASSWORD ?? process.env.NEXT_PUBLIC_MASTER_PASSWORD ?? '';

    if (!masterPassword) {
      return NextResponse.json(
        { ok: false, error: 'Dashboard não configurado. Defina MASTER_USER e MASTER_PASSWORD.' },
        { status: 503 }
      );
    }

    if (usuario === masterUser && senha === masterPassword) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Usuário ou senha master inválidos.' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }
}
