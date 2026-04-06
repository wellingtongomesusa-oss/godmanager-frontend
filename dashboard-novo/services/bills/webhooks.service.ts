/**
 * Webhooks – atualização de status via callbacks externos (ex: gateway de pagamento).
 * Em produção: assinatura HMAC, retry, persistência de eventos.
 */

export type WebhookEventType =
  | 'bill.status.updated'
  | 'bill.payment.scheduled'
  | 'bill.payment.completed'
  | 'bill.payment.failed';

export interface WebhookPayload {
  event: WebhookEventType;
  billId: string;
  status?: string;
  timestamp: string;
  source?: string;
  payload?: Record<string, unknown>;
}

export interface WebhookResult {
  received: boolean;
  processed: boolean;
  error?: string;
}

const subscribers: Array<(payload: WebhookPayload) => void | Promise<void>> = [];

/**
 * Registra um handler para eventos de webhook (ex: no serviço de bills).
 */
export function onWebhook(callback: (payload: WebhookPayload) => void | Promise<void>): () => void {
  subscribers.push(callback);
  return () => {
    const i = subscribers.indexOf(callback);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

/**
 * Simula recebimento de webhook externo e notifica subscribers.
 */
export async function receiveWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  try {
    for (const cb of subscribers) {
      await Promise.resolve(cb(payload));
    }
    return { received: true, processed: true };
  } catch (e) {
    return {
      received: true,
      processed: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Dispara evento local (para testes ou integração interna).
 */
export function emitWebhook(payload: Omit<WebhookPayload, 'timestamp'>): void {
  receiveWebhook({
    ...payload,
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}
