import { prisma } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';
import type { Partner, PartnerStatus } from '@prisma/client';

export interface CreatePartnerInput {
  userId: string;
  companyName: string;
  website?: string;
  rateLimit?: number;
  webhookUrl?: string;
}

export interface PartnerAPICall {
  partnerId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime?: number;
}

export class PartnersService {
  /**
   * Generate API key
   */
  private generateApiKey(): string {
    return `gdx_${randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Verify API key
   */
  async verifyApiKey(apiKey: string): Promise<Partner | null> {
    const hashedKey = this.hashApiKey(apiKey);
    
    return prisma.partner.findFirst({
      where: {
        apiKeyHash: hashedKey,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Create partner
   */
  async createPartner(input: CreatePartnerInput): Promise<Partner & { apiKey: string }> {
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    const partner = await prisma.partner.create({
      data: {
        userId: input.userId,
        companyName: input.companyName,
        website: input.website,
        apiKey: apiKey, // Store plain key (only shown once)
        apiKeyHash: apiKeyHash,
        status: 'PENDING',
        rateLimit: input.rateLimit || 100,
        webhookUrl: input.webhookUrl,
      },
    });

    return {
      ...partner,
      apiKey, // Return plain key only on creation
    };
  }

  /**
   * Activate partner
   */
  async activatePartner(partnerId: string): Promise<Partner> {
    return prisma.partner.update({
      where: { id: partnerId },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Log API call
   */
  async logAPICall(call: PartnerAPICall): Promise<void> {
    await prisma.partnerAPICall.create({
      data: call,
    });
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(partnerId: string): Promise<boolean> {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return false;
    }

    // Check calls in the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCalls = await prisma.partnerAPICall.count({
      where: {
        partnerId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    return recentCalls < partner.rateLimit;
  }

  /**
   * Get partner by user ID
   */
  async getPartnerByUserId(userId: string): Promise<Partner | null> {
    return prisma.partner.findUnique({
      where: { userId },
    });
  }

  /**
   * Get partner API usage statistics
   */
  async getPartnerStats(partnerId: string, days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalCalls, successfulCalls, failedCalls] = await Promise.all([
      prisma.partnerAPICall.count({
        where: {
          partnerId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.partnerAPICall.count({
        where: {
          partnerId,
          statusCode: { gte: 200, lt: 300 },
          createdAt: { gte: startDate },
        },
      }),
      prisma.partnerAPICall.count({
        where: {
          partnerId,
          statusCode: { gte: 400 },
          createdAt: { gte: startDate },
        },
      }),
    ]);

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
    };
  }
}

export const partnersService = new PartnersService();
