import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { auditTransactions } from '@/lib/auditTransactions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/audit/transactions
 * Recebe o CSV do QuickBooks "Transaction List by Date" (multipart 'file' OU corpo texto) e
 * devolve os achados de auditoria em 3 secoes. SOMENTE LEITURA — nao grava nada, nao toca dados.
 * Restrito a super_admin/admin (ferramenta interna de auditoria).
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!['super_admin', 'admin'].includes(String(user.role))) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    let csv = '';
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (file instanceof File) csv = await file.text();
    } else {
      csv = await req.text();
    }
    if (!csv || csv.length < 40) {
      return NextResponse.json({ ok: false, error: 'CSV vazio ou inválido.' }, { status: 400 });
    }
    if (csv.length > 20 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 20MB).' }, { status: 413 });
    }
    const result = auditTransactions(csv);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[POST /api/audit/transactions]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao processar a auditoria.' }, { status: 500 });
  }
}
