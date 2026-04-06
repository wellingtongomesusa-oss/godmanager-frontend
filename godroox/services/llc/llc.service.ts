import { prisma } from '@/lib/db';
import type { LLCOrder, LLCOrderStatus, LLCDocument } from '@prisma/client';

export interface CreateLLCOrderInput {
  userId: string;
  companyName: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  mailingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  registeredAgent?: string;
}

export class LLCService {
  /**
   * Create LLC order
   */
  async createOrder(input: CreateLLCOrderInput): Promise<LLCOrder> {
    // Check if company name is available (simplified)
    // In production, this would check with Florida state database
    
    const order = await prisma.lLCOrder.create({
      data: {
        userId: input.userId,
        status: 'DRAFT',
        companyName: input.companyName,
        registeredAgent: input.registeredAgent,
        businessAddress: input.businessAddress as any,
        mailingAddress: input.mailingAddress as any,
      },
    });

    return order;
  }

  /**
   * Submit LLC order for processing
   */
  async submitOrder(orderId: string, userId: string): Promise<LLCOrder> {
    const order = await prisma.lLCOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'DRAFT') {
      throw new Error('Order already submitted');
    }

    // Update status and submit
    const updated = await prisma.lLCOrder.update({
      where: { id: orderId },
      data: {
        status: 'SUBMITTED',
        filingDate: new Date(),
      },
    });

    // In production, this would trigger external API call to Florida state services
    // Simulate processing
    setTimeout(async () => {
      await prisma.lLCOrder.update({
        where: { id: orderId },
        data: {
          status: 'FILED',
        },
      });
    }, 5000);

    return updated;
  }

  /**
   * Upload document for LLC order
   */
  async uploadDocument(
    orderId: string,
    userId: string,
    type: string,
    fileName: string,
    fileUrl: string
  ): Promise<LLCDocument> {
    // Verify order belongs to user
    const order = await prisma.lLCOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const document = await prisma.lLCDocument.create({
      data: {
        orderId,
        type,
        fileName,
        fileUrl,
      },
    });

    return document;
  }

  /**
   * Get user's LLC orders
   */
  async getUserOrders(userId: string): Promise<LLCOrder[]> {
    return prisma.lLCOrder.findMany({
      where: { userId },
      include: {
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get LLC order by ID
   */
  async getOrderById(orderId: string, userId: string): Promise<LLCOrder | null> {
    return prisma.lLCOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        documents: true,
      },
    });
  }
}

export const llcService = new LLCService();
