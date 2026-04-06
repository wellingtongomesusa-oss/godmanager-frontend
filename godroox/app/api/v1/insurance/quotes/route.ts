import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { insuranceService } from '@/services/insurance/insurance.service';

const quoteSchema = z.object({
  coverageAmount: z.number().min(10000).max(10000000),
  termLength: z.number().int().min(10).max(30),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['male', 'female', 'other']),
  healthInfo: z.record(z.any()).optional(),
});

/**
 * POST /api/v1/insurance/quotes
 * Calculate insurance quote
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = quoteSchema.parse(body);

    const age = new Date().getFullYear() - new Date(validated.dateOfBirth).getFullYear();
    
    const quote = await insuranceService.calculateQuote(
      validated.coverageAmount,
      validated.termLength,
      age,
      validated.gender,
      validated.healthInfo
    );

    return successResponse(quote, 'Quote calculated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error calculating quote:', error);
    return errorResponse('Failed to calculate quote', 500);
  }
}
