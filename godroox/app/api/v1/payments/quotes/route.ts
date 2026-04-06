import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { paymentsService } from '@/services/payments/payments.service';

const quoteSchema = z.object({
  amount: z.number().min(1),
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
});

/**
 * POST /api/v1/payments/quotes
 * Get payment quote
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = quoteSchema.parse(body);

    const quote = await paymentsService.getQuote(
      validated.amount,
      validated.fromCurrency,
      validated.toCurrency
    );

    return successResponse(quote, 'Quote calculated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error calculating payment quote:', error);
    return errorResponse('Failed to calculate quote', 500);
  }
}
