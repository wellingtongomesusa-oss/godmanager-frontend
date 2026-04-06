import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSession } from '@/services/stripe/stripe.service';
import { mapPaymentStatus } from '@/services/stripe/stripe.service';
import { stripeConfig } from '@/services/stripe/stripe.config';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/stripe/status?session_id=cs_xxx
 * Retorna status do pagamento a partir da sessão de Checkout.
 */
export async function GET(request: NextRequest) {
  try {
    if (!stripeConfig.isConfigured()) {
      return errorResponse('Stripe is not configured', 503);
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      return errorResponse('Missing session_id', 400);
    }

    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return errorResponse('Session not found', 404);
    }

    const pi = session.payment_intent as { status?: string } | string | null;
    const piStatus = typeof pi === 'object' && pi?.status ? pi.status : null;
    const status = piStatus
      ? mapPaymentStatus(piStatus)
      : session.payment_status === 'paid'
        ? 'paid'
        : 'pending';

    return successResponse({
      sessionId: session.id,
      status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get status';
    return errorResponse(message, 500);
  }
}
