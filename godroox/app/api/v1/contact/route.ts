import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CONTACT_EMAIL = 'contact@godroox.com';
const CONTACT_ALERT_PHONE = '+13215194710';

const bodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  email: z.string().email('E-mail inválido'),
  phone: z.string().max(30).optional(),
  subject: z.string().min(1, 'Assunto é obrigatório').max(200),
  message: z.string().min(1, 'Mensagem é obrigatória').max(5000),
});

/**
 * POST /api/v1/contact
 * Envia o formulário de contato para contact@godroox.com e opcionalmente
 * envia SMS de alerta para +1 321 519 4710 (Twilio, se configurado).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { error: first?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  // 1) Enviar e-mail para contact@godroox.com
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      const from = process.env.RESEND_FROM ?? 'Godroox Contact <onboarding@resend.dev>';
      const text = [
        `Nome: ${name}`,
        `E-mail: ${email}`,
        phone ? `Telefone: ${phone}` : null,
        `Assunto: ${subject}`,
        '',
        'Mensagem:',
        message,
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await resend.emails.send({
        from,
        to: CONTACT_EMAIL,
        replyTo: email,
        subject: `[Contato Godroox] ${subject}`,
        text,
      });
      if (error) {
        console.error('[contact] Resend error:', error);
        return NextResponse.json(
          { error: 'Falha ao enviar e-mail. Tente novamente.' },
          { status: 500 }
        );
      }
    } catch (e) {
      console.error('[contact] Resend exception:', e);
      return NextResponse.json(
        { error: 'Falha ao enviar e-mail. Tente novamente.' },
        { status: 500 }
      );
    }
  } else {
    // Sem RESEND_API_KEY: em dev simulamos sucesso para testar o fluxo
    if (process.env.NODE_ENV === 'development') {
      console.log('[contact] (dev) E-mail seria enviado para', CONTACT_EMAIL, { name, email, subject });
    } else {
      return NextResponse.json(
        { error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY no .env.' },
        { status: 503 }
      );
    }
  }

  // 2) Alerta SMS para +1 321 519 4710 (Twilio, se configurado)
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (sid && token && fromNumber) {
    try {
      const twilio = await import('twilio');
      const client = twilio.default(sid, token);
      const smsBody = `[Godroox] Novo contato: ${name} – ${subject}. Ver ${CONTACT_EMAIL}`;
      await client.messages.create({
        body: smsBody.slice(0, 160),
        from: fromNumber,
        to: CONTACT_ALERT_PHONE,
      });
    } catch (e) {
      console.error('[contact] Twilio SMS error:', e);
      // Não falha a requisição: e-mail já foi enviado
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[contact] (dev) SMS de alerta seria enviado para', CONTACT_ALERT_PHONE);
  }

  return NextResponse.json({ ok: true, message: 'Mensagem enviada com sucesso.' });
}
