import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser, getClientScopeWhere } from '@/lib/clientScope';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const COPY_TO = process.env.MANAGER_PROP_CONTACT_EMAIL || 'contact@managerprop.com';

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: Request, { params }: { params: { jobId: string } }) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const scopeUser = toClientScopeUser(user);

    const body = (await req.json()) as {
      date1?: unknown;
      date2?: unknown;
      customMessage?: unknown;
    };
    const date1 = body?.date1 != null ? String(body.date1).trim() : '';
    const date2 = body?.date2 != null ? String(body.date2).trim() : '';
    const customMessage =
      body?.customMessage != null ? String(body.customMessage).trim() : '';

    if (!date1 || !date2) {
      return NextResponse.json({ ok: false, error: 'date1 and date2 required' }, { status: 400 });
    }
    if (date1 === date2) {
      return NextResponse.json({ ok: false, error: 'date1 and date2 must differ' }, { status: 400 });
    }

    const job = await prisma.pmExpense.findFirst({
      where: { id: params.jobId, ...getClientScopeWhere(scopeUser) },
      include: {
        vendor: { select: { companyName: true } },
        property: {
          include: {
            tenants: true,
          },
        },
      },
    });

    if (!job) return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
    if (!job.property) {
      return NextResponse.json({ ok: false, error: 'Property not linked' }, { status: 400 });
    }

    const tenants = (job.property.tenants || []).filter(
      (t) => !!t.email && String(t.email).includes('@'),
    );
    if (tenants.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Nenhum inquilino com email cadastrado nessa propriedade.',
        },
        { status: 400 },
      );
    }

    const propertyAddress = job.property.address || '(propriedade)';
    const propertyCode = job.property.code || '';
    const vendorLabel = job.vendor?.companyName?.trim() || 'fornecedor';

    const fmtDate = (d: string) => {
      try {
        return new Date(d).toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return String(d);
      }
    };

    const recipients = tenants.map((t) => t.email!.trim()).filter(Boolean);
    const tenantNames = tenants.map((t) => t.name || 'Inquilino').join(' / ');
    const customHtml = customMessage ? escapeHtml(customMessage).replace(/\n/g, '<br>') : '';

    const subject = `Visita técnica agendada — ${propertyAddress}`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
        <h2 style="color:#0f172a;margin:0 0 16px">Olá, ${escapeHtml(tenantNames)}!</h2>
      <p>Sua propriedade <strong>${escapeHtml(propertyAddress)}</strong> ${propertyCode ? `(${escapeHtml(propertyCode)})` : ''} receberá uma visita técnica em breve.</p>
        <p><strong>Profissional:</strong> ${escapeHtml(vendorLabel)}</p>
        <p>Oferecemos duas datas para sua escolha. Por favor responda este email confirmando qual prefere:</p>
        <table style="border-collapse:collapse;margin:14px 0">
          <tr>
            <td style="padding:10px 18px;background:#eef2ff;border-radius:8px;font-weight:600;color:#4338ca">
              Opção 1: ${escapeHtml(fmtDate(date1))}
            </td>
          </tr>
          <tr><td style="height:8px"></td></tr>
          <tr>
            <td style="padding:10px 18px;background:#eef2ff;border-radius:8px;font-weight:600;color:#4338ca">
              Opção 2: ${escapeHtml(fmtDate(date2))}
            </td>
          </tr>
        </table>
        ${customHtml ? `<p style="background:#f8fafc;padding:12px;border-left:3px solid #4f46e5;margin:16px 0"><em>${customHtml}</em></p>` : ''}
        <p>Aguardamos sua confirmação.</p>
        <p style="margin-top:24px;color:#64748b;font-size:13px">
          Atenciosamente,<br>
          <strong>Manager Prop LLC</strong><br>
          <a href="mailto:${escapeHtml(COPY_TO)}" style="color:#4f46e5">${escapeHtml(COPY_TO)}</a>
        </p>
      </div>
    `;

    const textBody = `Olá, ${tenantNames}.\n\nSua propriedade ${propertyAddress} receberá uma visita técnica.\n\nProfissional: ${vendorLabel}\n\nDatas disponíveis:\n- Opção 1: ${fmtDate(date1)}\n- Opção 2: ${fmtDate(date2)}\n\n${customMessage ? `${customMessage}\n\n` : ''}Responda este email confirmando.\n\nManager Prop LLC\n${COPY_TO}`;

    const emailResult = await sendEmail({
      to: recipients,
      bcc: [COPY_TO],
      replyTo: COPY_TO,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        { ok: false, error: emailResult.error || 'email_send_failed' },
        { status: 502 },
      );
    }

    const clientIdForComment = job.clientId ?? job.property.clientId;
    if (clientIdForComment) {
      try {
        const authorName =
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.email ||
          'User';
        await prisma.comment.create({
          data: {
            clientId: clientIdForComment,
            entityType: 'JOB',
            entityId: job.id,
            authorId: user.id,
            authorName,
            authorRole: String(user.role),
            content: `Notificação enviada ao(s) inquilino(s): ${tenantNames} (${recipients.join(', ')}). Datas oferecidas: ${fmtDate(date1)} e ${fmtDate(date2)}.`,
            metadata: { kind: 'tenant_notification', date1, date2, recipients },
          },
        });
      } catch (e) {
        console.warn('[notify-tenant] audit comment failed', e);
      }
    }

    return NextResponse.json({
      ok: true,
      sentTo: recipients,
      tenantNames,
    });
  } catch (e: unknown) {
    console.error('notify-tenant error:', e);
    const message = e instanceof Error ? e.message : 'falha';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
