import { prisma } from '@/lib/db';
import type { PaymentOrder, PaymentOrderStatus } from '@prisma/client';

export interface CreatePaymentOrderInput {
  userId: string;
  amount: number;
  currency: string;
  recipientName: string;
  recipientAccount: string;
  recipientBank?: string;
  recipientAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
}

export interface PaymentQuote {
  amount: number;
  currency: string;
  exchangeRate: number;
  fee: number;
  totalAmount: number;
  estimatedDelivery: string;
}

export class PaymentsService {
  /**
   * Get payment quote
   */
  async getQuote(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<PaymentQuote> {
    // Simplified quote calculation
    // In production, this would call payment provider APIs
    
    const exchangeRate = fromCurrency === toCurrency 
      ? 1.0 
      : 0.85; // Simplified rate (USD to EUR example)
    
    const fee = amount * 0.005; // 0.5% fee
    const totalAmount = amount + fee;
    
    return {
      amount,
      currency: toCurrency,
      exchangeRate,
      fee: Math.round(fee * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      estimatedDelivery: '1-2 business days',
    };
  }

  /**
   * Create payment order
   */
  async createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    // Get quote
    const quote = await this.getQuote(input.amount, 'USD', input.currency);

    const order = await prisma.paymentOrder.create({
      data: {
        userId: input.userId,
        status: 'PENDING',
        amount: input.amount,
        currency: input.currency,
        exchangeRate: quote.exchangeRate,
        fee: quote.fee,
        totalAmount: quote.totalAmount,
        recipientName: input.recipientName,
        recipientAccount: input.recipientAccount,
        recipientBank: input.recipientBank,
        recipientAddress: input.recipientAddress as any,
      },
    });

    return order;
  }

  /**
   * Process payment order
   */
  async processOrder(orderId: string, userId: string): Promise<PaymentOrder> {
    const order = await prisma.paymentOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new Error('Order already processed');
    }

    // In production, this would call payment provider API
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const updated = await prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
        transactionId,
      },
    });

    // Simulate completion after delay
    setTimeout(async () => {
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }, 10000);

    return updated;
  }

  /**
   * Get user's payment orders
   */
  async getUserOrders(userId: string): Promise<PaymentOrder[]> {
    return prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get payment order by ID
   */
  async getOrderById(orderId: string, userId: string): Promise<PaymentOrder | null> {
    return prisma.paymentOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });
  }
}

export const paymentsService = new PaymentsService();
