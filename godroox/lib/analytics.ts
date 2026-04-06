import { prisma } from './db';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Analytics service for sending events to Data Warehouse
 */

export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class AnalyticsService {
  private bigquery: BigQuery | null = null;

  constructor() {
    // Initialize BigQuery if credentials are available
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        this.bigquery = new BigQuery({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        });
      } catch (error) {
        console.warn('BigQuery not initialized:', error);
      }
    }
  }

  /**
   * Track event
   * Stores in PostgreSQL for immediate access and sends to BigQuery for analytics
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in PostgreSQL
      await prisma.analyticsEvent.create({
        data: {
          eventType: event.eventType,
          userId: event.userId,
          metadata: event.metadata as any,
        },
      });

      // Send to BigQuery (async, non-blocking)
      if (this.bigquery) {
        this.sendToBigQuery(event).catch((error) => {
          console.error('Error sending to BigQuery:', error);
        });
      }
    } catch (error) {
      console.error('Error tracking event:', error);
      // Don't throw - analytics should not break the main flow
    }
  }

  /**
   * Send event to BigQuery
   */
  private async sendToBigQuery(event: AnalyticsEvent): Promise<void> {
    if (!this.bigquery) return;

    const datasetId = process.env.BIGQUERY_DATASET || 'godroox_analytics';
    const tableId = 'events';

    const rows = [
      {
        event_type: event.eventType,
        user_id: event.userId || null,
        metadata: JSON.stringify(event.metadata || {}),
        timestamp: new Date().toISOString(),
      },
    ];

    await this.bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert(rows);
  }

  /**
   * Track common events
   */
  async trackCustomerCreated(userId: string): Promise<void> {
    await this.trackEvent({
      eventType: 'customer_created',
      userId,
    });
  }

  async trackPolicyCreated(policyId: string, userId: string): Promise<void> {
    await this.trackEvent({
      eventType: 'policy_created',
      userId,
      metadata: { policyId },
    });
  }

  async trackLLCFormed(orderId: string, userId: string): Promise<void> {
    await this.trackEvent({
      eventType: 'llc_formed',
      userId,
      metadata: { orderId },
    });
  }

  async trackPaymentSent(orderId: string, userId: string, amount: number): Promise<void> {
    await this.trackEvent({
      eventType: 'payment_sent',
      userId,
      metadata: { orderId, amount },
    });
  }

  async trackPartnerAPICall(partnerId: string, endpoint: string): Promise<void> {
    await this.trackEvent({
      eventType: 'partner_api_call',
      metadata: { partnerId, endpoint },
    });
  }
}

export const analytics = new AnalyticsService();
