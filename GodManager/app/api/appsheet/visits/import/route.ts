import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';
import { appSheetVisitsKey, normalizeAppSheetCsv, type AppSheetVisitsPayload } from '@/lib/appsheetVisits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/appsheet/visits/import  — sobe/atualiza o CSV do AppSheet (Job_LongTerm).
 * Aceita multipart (campo `file`) OU texto CSV cru no body. Substitui o conjunto do cliente em
 * AppSetting `appsheet:visits:<clientId>`. Read-only downstream (só informação). Admin/manager/super.
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'appsheet-visits-import', max: 10 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    let csvText = '';
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (file && typeof file !== 'string') csvText = await (file as File).text();
    } else {
      csvText = await req.text();
    }
    if (!csvText.trim()) return NextResponse.json({ ok: false, error: 'CSV vazio.' }, { status: 400 });

    const visits = normalizeAppSheetCsv(csvText);
    if (!visits.length) return NextResponse.json({ ok: false, error: 'Nenhuma visita reconhecida no CSV (cabeçalho esperado do AppSheet Job_LongTerm).' }, { status: 400 });

    const payload: AppSheetVisitsPayload = {
      visits, count: visits.length, source: 'AppSheet · Job_LongTerm', updatedAt: new Date().toISOString(),
    };
    await prisma.appSetting.upsert({
      where: { key: appSheetVisitsKey(scope.clientId) },
      create: { key: appSheetVisitsKey(scope.clientId), value: payload as unknown as object, updatedBy: user.email || user.id },
      update: { value: payload as unknown as object, updatedBy: user.email || user.id },
    });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'appsheet.visits_import', entity: 'app_setting', entityId: scope.clientId, clientId: scope.clientId,
      details: `import ${visits.length} visitas AppSheet`,
    });
    const months = [...new Set(visits.map((v) => v.month))].filter(Boolean).sort();
    return NextResponse.json({ ok: true, count: visits.length, months });
  } catch (e) {
    console.error('[POST /api/appsheet/visits/import]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao importar as visitas do AppSheet.' }, { status: 500 });
  }
}
