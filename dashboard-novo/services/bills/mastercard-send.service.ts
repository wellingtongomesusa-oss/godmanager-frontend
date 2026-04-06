/**
 * Mastercard Send API – validação de contas e pagamentos simulados.
 * Em produção: integrar com Mastercard Send API real (OAuth + endpoints).
 * Ref: https://developer.mastercard.com/product/mastercard-send
 */

export interface MastercardAccountValidationRequest {
  recipientAccountUri: string;
  recipientName?: string;
  currency?: string;
}

export interface MastercardAccountValidationResult {
  valid: boolean;
  accountId?: string;
  errorCode?: string;
  message?: string;
}

export interface MastercardPaymentRequest {
  transferReference: string;
  amount: number;
  currency: string;
  recipientAccountUri: string;
  senderName?: string;
  description?: string;
}

export interface MastercardPaymentResult {
  success: boolean;
  transactionId?: string;
  status?: 'completed' | 'pending' | 'failed';
  errorCode?: string;
  message?: string;
}

/**
 * Simula validação de conta (ex: IBAN, account number).
 * Em produção: POST para Mastercard Send API.
 */
export async function validateAccount(
  request: MastercardAccountValidationRequest
): Promise<MastercardAccountValidationResult> {
  await delay(300);
  const uri = (request.recipientAccountUri ?? '').toLowerCase();
  if (!uri) {
    return { valid: false, errorCode: 'MISSING_ACCOUNT', message: 'Account URI required' };
  }
  if (uri.includes('invalid')) {
    return { valid: false, errorCode: 'INVALID_ACCOUNT', message: 'Account not found' };
  }
  return {
    valid: true,
    accountId: `mc-${Date.now().toString(36)}`,
  };
}

/**
 * Simula envio de pagamento via Mastercard Send.
 * Em produção: chamar API de transferência.
 */
export async function sendPayment(
  request: MastercardPaymentRequest
): Promise<MastercardPaymentResult> {
  await delay(500);
  if (request.amount <= 0) {
    return {
      success: false,
      status: 'failed',
      errorCode: 'INVALID_AMOUNT',
      message: 'Amount must be positive',
    };
  }
  return {
    success: true,
    transactionId: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    status: 'completed',
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
