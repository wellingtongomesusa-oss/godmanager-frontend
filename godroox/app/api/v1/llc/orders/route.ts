import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { llcService } from '@/services/llc/llc.service';

const createOrderSchema = z.object({
  companyName: z.string().min(1),
  businessAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }),
  mailingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }).optional(),
  registeredAgent: z.string().optional(),
});

/**
 * POST /api/v1/llc/orders
 * Create LLC order
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = createOrderSchema.parse(body);

    const order = await llcService.createOrder({
      userId: auth.userId,
      ...validated,
    });

    return successResponse(order, 'LLC order created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error creating LLC order:', error);
    return errorResponse('Failed to create LLC order', 500);
  }
}

/**
 * GET /api/v1/llc/orders
 * Get user's LLC orders
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const orders = await llcService.getUserOrders(auth.userId);

    return successResponse(orders);
  } catch (error) {
    console.error('Error fetching LLC orders:', error);
    return errorResponse('Failed to fetch LLC orders', 500);
  }
}
