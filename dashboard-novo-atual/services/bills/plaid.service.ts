/**
 * Plaid – validação bancária simulada (link de conta, verificação de saldo).
 * Em produção: usar Plaid Link + Plaid API (auth, balance, identity).
 * Ref: https://plaid.com/docs/
 */

export interface PlaidLinkTokenRequest {
  userId: string;
  clientName?: string;
}

export interface PlaidLinkTokenResult {
  linkToken: string;
  expiration: string;
}

export interface PlaidBalanceResult {
  available: number;
  current: number;
  currency: string;
  institutionName?: string;
}

export interface PlaidAccountValidationResult {
  valid: boolean;
  accountId?: string;
  accountName?: string;
  errorCode?: string;
  message?: string;
}

/**
 * Simula criação de Link token para conectar conta bancária.
 */
export async function createLinkToken(
  request: PlaidLinkTokenRequest
): Promise<PlaidLinkTokenResult> {
  await delay(200);
  return {
    linkToken: `link-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Simula verificação de saldo após exchange de public_token.
 */
export async function getBalance(publicToken: string): Promise<PlaidBalanceResult | null> {
  await delay(300);
  if (!publicToken) return null;
  return {
    available: 50000.0,
    current: 52100.0,
    currency: 'USD',
    institutionName: 'Chase (sandbox)',
  };
}

/**
 * Simula validação de conta bancária para pagamento de bill.
 */
export async function validateBankAccount(
  accountId: string,
  amount: number
): Promise<PlaidAccountValidationResult> {
  await delay(250);
  if (!accountId) {
    return { valid: false, errorCode: 'MISSING_ACCOUNT', message: 'Account ID required' };
  }
  return {
    valid: true,
    accountId,
    accountName: 'Checking ****4521',
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
