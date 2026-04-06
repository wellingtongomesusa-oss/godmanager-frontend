import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { partnersService } from '@/services/partners/partners.service';

const createPartnerSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().url().optional(),
  rateLimit: z.number().int().min(10).max(10000).optional(),
  webhookUrl: z.string().url().optional(),
});

/**
 * POST /api/v1/partners
 * Create partner account
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = createPartnerSchema.parse(body);

    const partner = await partnersService.createPartner({
      userId: auth.userId,
      ...validated,
    });

    // Return partner with API key (only shown once)
    return successResponse(
      {
        id: partner.id,
        companyName: partner.companyName,
        apiKey: partner.apiKey, // Only returned on creation
        status: partner.status,
        rateLimit: partner.rateLimit,
      },
      'Partner created successfully. Save your API key - it will not be shown again.',
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error creating partner:', error);
    return errorResponse('Failed to create partner', 500);
  }
}

/**
 * GET /api/v1/partners
 * Get partner information
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const partner = await partnersService.getPartnerByUserId(auth.userId);
    
    if (!partner) {
      return errorResponse('Partner not found', 404);
    }

    // Don't return API key hash
    const { apiKeyHash, ...partnerData } = partner;

    return successResponse(partnerData);
  } catch (error) {
    console.error('Error fetching partner:', error);
    return errorResponse('Failed to fetch partner', 500);
  }
}
