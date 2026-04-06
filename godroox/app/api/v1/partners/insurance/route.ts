import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { partnersService } from '@/services/partners/partners.service';
import { insuranceService } from '@/services/insurance/insurance.service';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

const partnerAuthSchema = z.object({
  'x-api-key': z.string(),
});

const createInsuranceApplicationSchema = z.object({
  customerId: z.string(), // Partner's customer ID
  coverageAmount: z.number().min(10000).max(10000000),
  termLength: z.number().int().min(10).max(30),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['male', 'female', 'other']),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  healthInfo: z.record(z.any()).optional(),
});

/**
 * POST /api/v1/partners/insurance
 * Partner API: Create insurance application
 * Requires: X-API-Key header
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate partner via API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return unauthorizedResponse('API key required');
    }

    const partner = await partnersService.verifyApiKey(apiKey);
    if (!partner) {
      return unauthorizedResponse('Invalid API key');
    }

    // Check rate limit
    const withinRateLimit = await partnersService.checkRateLimit(partner.id);
    if (!withinRateLimit) {
      return errorResponse('Rate limit exceeded', 429);
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = createInsuranceApplicationSchema.parse(body);

    // Create application (using partner's user ID as the owner)
    // In production, you might want a separate customer mapping
    const application = await insuranceService.createApplication({
      userId: partner.userId, // Or map to actual customer
      ...validated,
      dateOfBirth: new Date(validated.dateOfBirth),
    });

    // Log API call
    const responseTime = Date.now() - startTime;
    await partnersService.logAPICall({
      partnerId: partner.id,
      endpoint: '/api/v1/partners/insurance',
      method: 'POST',
      statusCode: 201,
      responseTime,
    });

    return successResponse(
      {
        applicationId: application.id,
        status: application.status,
        quoteId: application.quoteId,
        monthlyPremium: application.monthlyPremium,
      },
      'Insurance application created successfully',
      201
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Log failed API call if we have partner context
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      const partner = await partnersService.verifyApiKey(apiKey);
      if (partner) {
        await partnersService.logAPICall({
          partnerId: partner.id,
          endpoint: '/api/v1/partners/insurance',
          method: 'POST',
          statusCode: error instanceof z.ZodError ? 400 : 500,
          responseTime,
        });
      }
    }

    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error creating insurance application via partner API:', error);
    return errorResponse('Failed to create insurance application', 500);
  }
}
