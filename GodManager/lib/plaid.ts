import { Configuration, PlaidApi, PlaidEnvironments, type AccountBase } from 'plaid';

type PlaidEnvName = 'sandbox' | 'development' | 'production';

let plaidClient: PlaidApi | null = null;

function resolvePlaidBasePath(): string {
  const envRaw = (process.env.PLAID_ENV || 'sandbox').trim().toLowerCase();
  const envName = envRaw as PlaidEnvName;
  const basePath = PlaidEnvironments[envName];
  if (!basePath) {
    throw new Error(
      `PLAID_ENV invalido: "${process.env.PLAID_ENV}". Use sandbox, development ou production.`,
    );
  }
  return basePath;
}

function requirePlaidCredentials(): { clientId: string; secret: string } {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  if (!clientId) {
    throw new Error('PLAID_CLIENT_ID nao configurado.');
  }
  if (!secret) {
    throw new Error('PLAID_SECRET nao configurado.');
  }
  return { clientId, secret };
}

/** Cliente Plaid lazy — credenciais lidas apenas na primeira chamada. */
export function getPlaidClient(): PlaidApi {
  if (plaidClient) return plaidClient;

  const { clientId, secret } = requirePlaidCredentials();
  const basePath = resolvePlaidBasePath();

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  plaidClient = new PlaidApi(configuration);
  return plaidClient;
}

/** Prefer checking depository account for ACH link metadata. */
export function pickPlaidAccount(accounts: AccountBase[]): AccountBase | null {
  if (!accounts.length) return null;
  const checking = accounts.find((a) => a.type === 'depository' && a.subtype === 'checking');
  if (checking) return checking;
  const depository = accounts.find((a) => a.type === 'depository');
  return depository ?? accounts[0];
}
