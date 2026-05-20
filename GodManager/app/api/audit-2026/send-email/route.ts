import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** Alinhado a ownerStatementEmail: test inbox fora de PROD ou com GM_OWNER_STMT_EMAIL_TEST */
function auditEmailUseTestInbox(): boolean {
  if (process.env.GM_OWNER_STMT_EMAIL_TEST === '1') return true;
  if (process.env.GM_OWNER_STMT_EMAIL_TEST === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

const TEST_INBOX = 'w@godmanager.us';

type Body = {
  to?: string;
  pdfBase64?: string;
  propertyLabel?: string;
  periodLabel?: string;
  ownerName?: string;
  netUsd?: number;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const requestedTo = String(body.to || '').trim().toLowerCase();
    const b64 = String(body.pdfBase64 || '').trim();
    const prop = String(body.propertyLabel || 'Property').slice(0, 500);
    const period = String(body.periodLabel || '—').slice(0, 200);
    const owner = String(body.ownerName || '').slice(0, 200);
    const netUsd = typeof body.netUsd === 'number' && Number.isFinite(body.netUsd) ? body.netUsd : null;

    if (!requestedTo || !requestedTo.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Email destinatario invalido.' }, { status: 400 });
    }
    if (!b64) {
      return NextResponse.json({ ok: false, error: 'PDF em falta.' }, { status: 400 });
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      return NextResponse.json({ ok: false, error: 'PDF base64 invalido.' }, { status: 400 });
    }
    if (buf.length < 100 || buf.length > 12 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Tamanho do PDF invalido.' }, { status: 400 });
    }

    const useTest = auditEmailUseTestInbox();
    const envelopeTo = useTest ? TEST_INBOX : requestedTo;
    const subjectPrefix = useTest ? '[TEST Auditoria 2026] ' : '';

    const netStr =
      netUsd != null
        ? netUsd.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })
        : '—';

    const html = `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.5;color:#1a1a1c;background:#f8f6f2;padding:16px;">
<p>Segue em anexo o <b>Owner Statement</b> (Auditoria 2026).</p>
<ul>
<li><b>Propriedade:</b> ${escapeHtml(prop)}</li>
<li><b>Periodo:</b> ${escapeHtml(period)}</li>
<li><b>Owner:</b> ${escapeHtml(owner || '—')}</li>
<li><b>Net payout (3250):</b> ${escapeHtml(netStr)}</li>
</ul>
${useTest ? `<p style="color:#8a8580;font-size:12px">Modo teste: email entregue a <b>${escapeHtml(envelopeTo)}</b>; destinatario pedido foi <b>${escapeHtml(requestedTo)}</b>.</p>` : ''}
<p style="font-size:12px;color:#8a8580;">GodManager.com — Manager Prop LLC</p>
</body></html>`;

    const sent = await sendEmail({
      to: envelopeTo,
      subject: `${subjectPrefix}Owner Statement — ${prop.slice(0, 80)}`,
      html,
      attachments: [{ filename: 'Owner_Statement.pdf', content: buf }],
    });

    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: sent.error || 'Envio falhou.', sentTo: envelopeTo, testMode: useTest },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: envelopeTo,
      requestedTo,
      testMode: useTest,
      emailId: sent.id ?? null,
    });
  } catch (e) {
    console.error('[audit-2026/send-email]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
