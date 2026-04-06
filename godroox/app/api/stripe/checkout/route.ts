import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/services/stripe/stripe.service';
import { stripeConfig } from '@/services/stripe/stripe.config';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

const schema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('usd'),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * POST /api/stripe/checkout
 * Cria sessão de Checkout Stripe. Retorna { url, sessionId }.
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripeConfig.isConfigured()) {
      return errorResponse('Stripe is not configured', 503);
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation error', 400, parsed.error.errors[0]?.message);
    }

    const auth = await authenticateRequest(request);
    const baseUrl = request.nextUrl.origin;
    const defaultSuccess = `${baseUrl}/pagamentos-internacionais?stripe=success`;
    const defaultCancel = `${baseUrl}/pagamentos-internacionais?stripe=cancel`;
    let successUrl = parsed.data.successUrl || defaultSuccess;
    let cancelUrl = parsed.data.cancelUrl || defaultCancel;
    if (!successUrl.includes('{CHECKOUT_SESSION_ID}')) {
      successUrl += (successUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}';
    }

    const result = await createCheckoutSession({
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      successUrl,
      cancelUrl,
      description: parsed.data.description,
      metadata: parsed.data.metadata,
      userId: auth?.userId,
    });

    return successResponse(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create checkout session';
    return errorResponse(message, 500);
  }
}
