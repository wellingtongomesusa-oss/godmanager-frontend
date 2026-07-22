import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/rent-receipts/appfolio-robot { month }
 * SCAFFOLD do robô que busca o comprovante de pagamento no AppFolio e anexa em cada casa
 * (grava em RentReceiptConfirmation.receiptFileKey via putObject, receiptSource='appfolio_robot').
 *
 * Env-gated: só roda quando o acesso ao AppFolio estiver configurado (APPFOLIO_ROBOT_ENABLED=1 +
 * credenciais). Sem isso, responde 501 com instrução — NUNCA falha o app nem executa scraping
 * de forma não autorizada. A lógica de coleta (login/sessão/download) entra quando Wellington
 * fornecer o acesso oficial do AppFolio.
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'rent-receipts-robot', max: 6 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  const scope = await resolveBankAccountClientScope(user, null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const enabled = process.env.APPFOLIO_ROBOT_ENABLED === '1';
  if (!enabled) {
    return NextResponse.json(
      {
        ok: false,
        notConfigured: true,
        error:
          'Robô do AppFolio ainda não configurado. Configure o acesso oficial do AppFolio (APPFOLIO_ROBOT_ENABLED=1 + credenciais) para ativar a busca e anexação automática de comprovantes.',
      },
      { status: 501 },
    );
  }
  // TODO (com acesso AppFolio): autenticar via caminho oficial, localizar os comprovantes do mês
  // por casa, baixar o PDF, putObject em rent-receipts/<clientId>/<month>/<casa>.pdf e upsert
  // RentReceiptConfirmation.receiptFileKey (receiptSource='appfolio_robot'). Retornar {attached, skipped}.
  return NextResponse.json({ ok: true, attached: 0, skipped: 0, note: 'Robô habilitado — coleta a implementar com o acesso AppFolio.' });
}
