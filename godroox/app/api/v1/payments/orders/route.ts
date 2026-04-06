import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { paymentsService } from '@/services/payments/payments.service';

const createOrderSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().length(3),
  recipientName: z.string().min(1),
  recipientAccount: z.string().min(1),
  recipientBank: z.string().optional(),
  recipientAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string(),
  }).optional(),
});

/**
 * POST /api/v1/payments/orders
 * Create payment order
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const body = await request.json();
    const validated = createOrderSchema.parse(body);

    const order = await paymentsService.createOrder({
      userId: auth.userId,
      ...validated,
    });

    return successResponse(order, 'Payment order created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors[0].message);
    }
    console.error('Error creating payment order:', error);
    return errorResponse('Failed to create payment order', 500);
  }
}

/**
 * GET /api/v1/payments/orders
 * Get user's payment orders
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return unauthorizedResponse('Authentication required');
    }

    const orders = await paymentsService.getUserOrders(auth.userId);

    return successResponse(orders);
  } catch (error) {
    console.error('Error fetching payment orders:', error);
    return errorResponse('Failed to fetch payment orders', 500);
  }
}
