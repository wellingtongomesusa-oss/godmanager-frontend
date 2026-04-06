import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  return NextResponse.json({
    ok: true,
    mensagem: 'Callback Ramp (demo).',
    codeRecebido: Boolean(code),
  });
}
