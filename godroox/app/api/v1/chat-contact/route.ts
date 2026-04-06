import { NextResponse } from 'next/server';
import { sendChatNotification } from '@/services/sms/sms.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, service, message } = body as {
      name?: string;
      email?: string;
      phone?: string;
      service?: string;
      message?: string;
    };

    // Validação básica
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'E-mail válido é obrigatório.' }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória.' }, { status: 400 });
    }

    // Envia SMS para notificação
    const smsResult = await sendChatNotification({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      service: service?.trim(),
      message: message.trim(),
    });

    // Log da submissão
    console.log('[Chat Contact] Formulário recebido:', {
      name,
      email,
      phone,
      service,
      messageLength: message?.length,
      smsResult,
    });

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso! Entraremos em contato em breve.',
      smsSent: smsResult.success,
    });
  } catch (err) {
    console.error('[Chat Contact] Error:', err);
    return NextResponse.json(
      { error: 'Erro ao processar a mensagem.' },
      { status: 500 }
    );
  }
}
