import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { insuranceService } from '@/services/insurance/insurance.service';

const applicationSchema = z.object({
  coverageAmount: z.number().min(10000).max(10000000),
  termLength: z.number().int().min(10).max(30),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
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
 * POST /api/v1/insurance/applications
 * Create insurance application
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = applicationSchema.parse(body);

    const application = await insuranceService.createApplication({
      userId: auth.userId,
      ...validated,
      dateOfBirth: new Date(validated.dateOfBirth),
    });

    return successResponse(application, 'Application created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error creating application:', error);
    return errorResponse('Failed to create application', 500);
  }
}

/**
 * GET /api/v1/insurance/applications
 * Get user's insurance applications
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const applications = await insuranceService.getUserApplications(auth.userId);

    return successResponse(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    return errorResponse('Failed to fetch applications', 500);
  }
}
