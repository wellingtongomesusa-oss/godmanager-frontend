import {
  ACHClass,
  TransferAuthorizationDecision,
  TransferNetwork,
  TransferType,
} from 'plaid';
import { getPlaidClient } from '@/lib/plaid';

export type TransferDir = 'DEBIT' | 'CREDIT';

/** Movimentação de dinheiro só acontece com a flag explicitamente ligada. */
export function isPlaidTransferEnabled(): boolean {
  return String(process.env.PLAID_TRANSFER_ENABLED || '').trim().toLowerCase() === 'true';
}

/** true quando o ambiente Plaid é produção (dinheiro real). */
export function isPlaidProduction(): boolean {
  return String(process.env.PLAID_ENV || 'sandbox').trim().toLowerCase() === 'production';
}

export interface CreateTransferInput {
  accessToken: string;
  accountId: string;
  direction: TransferDir;
  amount: string | number;
  legalName: string;
  description?: string;
  achClass?: 'ppd' | 'ccd';
}

export interface CreateTransferResult {
  ok: boolean;
  error?: string;
  authorizationId?: string;
  transferId?: string;
  status?: string;
  decision?: string;
}

function normAmount(a: string | number): string {
  const n = typeof a === 'number' ? a : Number(a);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toFixed(2);
}

function plaidErr(e: unknown): string {
  const anyE = e as {
    response?: { data?: { error_message?: string; error_code?: string } };
    message?: string;
  };
  return (
    anyE?.response?.data?.error_message ||
    anyE?.response?.data?.error_code ||
    anyE?.message ||
    'erro desconhecido'
  );
}

/**
 * Débito (puxa da conta do cliente) ou crédito (envia para a conta do cliente) via
 * Plaid Transfer. Faz o fluxo em 2 passos: autorização (Plaid decide risco/saldo — nada
 * move) e criação da transferência. Retorna resultado estruturado; nunca lança para o caller.
 */
export async function createBankTransfer(
  input: CreateTransferInput,
): Promise<CreateTransferResult> {
  if (!isPlaidTransferEnabled()) {
    return { ok: false, error: 'Plaid Transfer desabilitado (PLAID_TRANSFER_ENABLED != true).' };
  }
  const amount = normAmount(input.amount);
  if (!amount) return { ok: false, error: 'Valor inválido.' };

  const plaid = getPlaidClient();
  const type = input.direction === 'CREDIT' ? TransferType.Credit : TransferType.Debit;
  const achClass = input.achClass === 'ccd' ? ACHClass.Ccd : ACHClass.Ppd;
  const description = (input.description || 'GodManager').slice(0, 15);

  // 1) Autorização — Plaid avalia saldo/risco. Nenhum dinheiro se move aqui.
  let authorizationId: string;
  let decision: string;
  try {
    const auth = await plaid.transferAuthorizationCreate({
      access_token: input.accessToken,
      account_id: input.accountId,
      type,
      network: TransferNetwork.Ach,
      amount,
      ach_class: achClass,
      user: { legal_name: input.legalName || 'Account Holder' },
    });
    authorizationId = auth.data.authorization.id;
    decision = String(auth.data.authorization.decision);
    if (auth.data.authorization.decision !== TransferAuthorizationDecision.Approved) {
      const rr = auth.data.authorization.decision_rationale;
      return {
        ok: false,
        authorizationId,
        decision,
        error: `Autorização não aprovada: ${decision}${rr ? ` (${rr.description})` : ''}`,
      };
    }
  } catch (e) {
    return { ok: false, error: `Falha na autorização Plaid: ${plaidErr(e)}` };
  }

  // 2) Cria a transferência de fato (usa a autorização aprovada).
  try {
    const tr = await plaid.transferCreate({
      access_token: input.accessToken,
      account_id: input.accountId,
      authorization_id: authorizationId,
      description,
    });
    return {
      ok: true,
      authorizationId,
      decision,
      transferId: tr.data.transfer.id,
      status: String(tr.data.transfer.status),
    };
  } catch (e) {
    return {
      ok: false,
      authorizationId,
      decision,
      error: `Falha ao criar transferência: ${plaidErr(e)}`,
    };
  }
}
