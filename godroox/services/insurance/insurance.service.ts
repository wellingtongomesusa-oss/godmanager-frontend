import { prisma } from '@/lib/db';
import type {
  InsuranceApplication,
  InsuranceApplicationStatus,
  InsurancePolicy,
} from '@prisma/client';

export interface CreateInsuranceApplicationInput {
  userId: string;
  coverageAmount: number;
  termLength: number;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  healthInfo?: Record<string, any>;
}

export interface InsuranceQuote {
  coverageAmount: number;
  termLength: number;
  monthlyPremium: number;
  annualPremium: number;
  quoteId: string;
}

export class InsuranceService {
  /**
   * Calculate insurance quote
   * In production, this would integrate with insurance providers
   */
  async calculateQuote(
    coverageAmount: number,
    termLength: number,
    age: number,
    gender: string,
    healthInfo?: Record<string, any>
  ): Promise<InsuranceQuote> {
    // Simplified quote calculation
    // In production, this would call external insurance APIs
    
    const baseRate = 0.001; // 0.1% of coverage per month
    const ageMultiplier = age < 30 ? 1.0 : age < 40 ? 1.2 : age < 50 ? 1.5 : 2.0;
    const genderMultiplier = gender === 'male' ? 1.1 : 1.0;
    const termMultiplier = termLength === 10 ? 1.0 : termLength === 20 ? 1.2 : 1.5;
    
    const monthlyPremium = coverageAmount * baseRate * ageMultiplier * genderMultiplier * termMultiplier;
    const annualPremium = monthlyPremium * 12;
    
    const quoteId = `QUOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      coverageAmount,
      termLength,
      monthlyPremium: Math.round(monthlyPremium * 100) / 100,
      annualPremium: Math.round(annualPremium * 100) / 100,
      quoteId,
    };
  }

  /**
   * Create insurance application
   */
  async createApplication(
    input: CreateInsuranceApplicationInput
  ): Promise<InsuranceApplication> {
    // Calculate quote
    const age = new Date().getFullYear() - new Date(input.dateOfBirth).getFullYear();
    const quote = await this.calculateQuote(
      input.coverageAmount,
      input.termLength,
      age,
      input.gender,
      input.healthInfo
    );

    // Create application
    const application = await prisma.insuranceApplication.create({
      data: {
        userId: input.userId,
        status: 'DRAFT',
        coverageAmount: input.coverageAmount,
        termLength: input.termLength,
        monthlyPremium: quote.monthlyPremium,
        quoteId: quote.quoteId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        address: input.address as any,
        healthInfo: input.healthInfo as any,
      },
    });

    return application;
  }

  /**
   * Submit insurance application
   */
  async submitApplication(
    applicationId: string
  ): Promise<InsuranceApplication> {
    const application = await prisma.insuranceApplication.update({
      where: { id: applicationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // In production, this would trigger external API calls to insurance providers
    // For now, simulate approval after 24 hours
    
    return application;
  }

  /**
   * Get user's insurance applications
   */
  async getUserApplications(userId: string): Promise<InsuranceApplication[]> {
    return prisma.insuranceApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get insurance application by ID
   */
  async getApplicationById(
    applicationId: string,
    userId: string
  ): Promise<InsuranceApplication | null> {
    return prisma.insuranceApplication.findFirst({
      where: {
        id: applicationId,
        userId,
      },
      include: {
        policy: true,
      },
    });
  }

  /**
   * Create insurance policy (after approval)
   */
  async createPolicy(
    applicationId: string
  ): Promise<InsurancePolicy> {
    const application = await prisma.insuranceApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'APPROVED') {
      throw new Error('Application not approved');
    }

    const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const policy = await prisma.insurancePolicy.create({
      data: {
        applicationId,
        policyNumber,
        status: 'ACTIVE',
        coverageAmount: application.coverageAmount,
        monthlyPremium: application.monthlyPremium || 0,
        startDate: new Date(),
        endDate: new Date(
          new Date().setFullYear(new Date().getFullYear() + application.termLength)
        ),
      },
    });

    return policy;
  }
}

export const insuranceService = new InsuranceService();
