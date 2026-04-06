import { NextRequest, NextResponse } from 'next/server';

/**
 * Callback OAuth QuickBooks — em produção, trocar code por tokens (POST Intuit token URL).
 * Demo: devolve JSON confirmando receção do código.
 */
export function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  return NextResponse.json({
    ok: true,
    mensagem: 'Callback QuickBooks (demo). Troque o código por tokens no servidor.',
    codeRecebido: Boolean(code),
    state,
  });
}
