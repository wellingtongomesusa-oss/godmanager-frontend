/**
 * Payment Limits Service
 * 
 * Manages payment limits per hour based on country of origin.
 * This service implements business rules for compliance and risk management.
 * 
 * TODO: In production, these limits should be:
 * - Stored in database for easy configuration
 * - Managed through admin dashboard
 * - Integrated with risk management systems
 * - Logged for audit purposes
 */

export interface PaymentLimit {
  country: string;
  limitPerHour: number; // in USD
  currency: string;
}

export interface PaymentAttempt {
  country: string;
  amount: number;
  currency: string;
  timestamp: Date;
}

// Payment limits per country (in USD)
// TODO: Move to database configuration table
const PAYMENT_LIMITS: Record<string, PaymentLimit> = {
  US: {
    country: 'US',
    limitPerHour: 10000, // $10,000 USD per hour
    currency: 'USD',
  },
  BR: {
    country: 'BR',
    limitPerHour: 5000, // $5,000 USD per hour (converted from BRL)
    currency: 'USD',
  },
  // Add more countries as needed
  CA: {
    country: 'CA',
    limitPerHour: 8000,
    currency: 'USD',
  },
  MX: {
    country: 'MX',
    limitPerHour: 3000,
    currency: 'USD',
  },
  DEFAULT: {
    country: 'DEFAULT',
    limitPerHour: 5000,
    currency: 'USD',
  },
};

export class PaymentLimitsService {
  /**
   * Get payment limit for a country
   */
  static getLimitForCountry(country: string): PaymentLimit {
    return PAYMENT_LIMITS[country] || PAYMENT_LIMITS.DEFAULT;
  }

  /**
   * Check if a payment amount is within the hourly limit
   * 
   * TODO: In production, this should:
   * - Query database for recent payments in the last hour
   * - Use Redis for fast lookups
   * - Consider user-specific limits
   * - Integrate with fraud detection systems
   */
  static async checkLimit(
    country: string,
    amount: number,
    currency: string,
    userId?: string
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = this.getLimitForCountry(country);
    
    // TODO: Replace with actual database query
    // Example:
    // const recentPayments = await prisma.paymentOrder.findMany({
    //   where: {
    //     userId,
    //     country,
    //     createdAt: {
    //       gte: new Date(Date.now() - 3600000), // Last hour
    //     },
    //   },
    // });
    // const totalInLastHour = recentPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // For now, simulate with localStorage (client-side) or in-memory (server-side)
    const recentPayments: PaymentAttempt[] = this.getRecentPayments(country, userId);
    const totalInLastHour = recentPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const remaining = limit.limitPerHour - totalInLastHour;
    const allowed = amount <= remaining;

    return {
      allowed,
      remaining: Math.max(0, remaining),
      limit: limit.limitPerHour,
    };
  }

  /**
   * Record a payment attempt
   * 
   * TODO: In production, store in database
   */
  static recordPayment(country: string, amount: number, currency: string, userId?: string): void {
    const payment: PaymentAttempt = {
      country,
      amount,
      currency,
      timestamp: new Date(),
    };

    // TODO: Store in database
    // await prisma.paymentAttempt.create({ data: { ... } });
    
    // For demo: store in memory/localStorage
    this.storePaymentAttempt(payment, userId);
  }

  /**
   * Get recent payments (last hour)
   * TODO: Replace with database query
   */
  private static getRecentPayments(country: string, userId?: string): PaymentAttempt[] {
    // In production, query database
    // For demo, use localStorage or in-memory storage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`payments_${country}_${userId || 'anonymous'}`);
      if (stored) {
        const payments: PaymentAttempt[] = JSON.parse(stored);
        const oneHourAgo = new Date(Date.now() - 3600000);
        return payments.filter(p => new Date(p.timestamp) > oneHourAgo);
      }
    }
    return [];
  }

  /**
   * Store payment attempt
   * TODO: Replace with database storage
   */
  private static storePaymentAttempt(payment: PaymentAttempt, userId?: string): void {
    if (typeof window !== 'undefined') {
      const key = `payments_${payment.country}_${userId || 'anonymous'}`;
      const existing = this.getRecentPayments(payment.country, userId);
      existing.push(payment);
      localStorage.setItem(key, JSON.stringify(existing));
    }
  }

  /**
   * Convert amount to USD for limit checking
   * TODO: Integrate with currency conversion API
   */
  static async convertToUSD(amount: number, fromCurrency: string): Promise<number> {
    // TODO: Use real exchange rate API (e.g., ExchangeRate-API, Fixer.io)
    // For now, use simplified conversion
    const rates: Record<string, number> = {
      USD: 1,
      BRL: 0.2, // 1 BRL = 0.2 USD (example)
      EUR: 1.1,
      GBP: 1.3,
    };

    const rate = rates[fromCurrency] || 1;
    return amount * rate;
  }
}
