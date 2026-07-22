/**
 * Motor de classificação da conciliação — regras da Flórida (FREC 61J2-14 / Ch. 475 F.S., trust
 * accounting) para property management. Determina, por transação bancária, a categoria/conta e o
 * tipo de lançamento no QuickBooks, com a justificativa da regra e um nível de confiança.
 *
 * Puro (sem I/O). O robô usa isto para propor a conciliação; a APLICAÇÃO no QBO exige aprovação.
 *
 * Contas (last4 → papel): 6352 OPERATING (dinheiro da empresa), 7236 TRUST (dinheiro de terceiros:
 * aluguéis a repassar), 7509 SECURITY DEPOSIT (cauções — passivo, nunca receita, nunca comingled).
 */

export type FlAccountKey = 'OPERATING_TRUST' | 'TRUST_CHASE' | 'DEPOSIT_SECURITY' | string;

export type FlEntryType = 'purchase' | 'deposit' | 'transfer' | 'journal';
export type FlConfidence = 'high' | 'medium' | 'low';

export interface FlReconcilePlan {
  /** Rótulo legível da categoria/conta destino no QBO. */
  category: string;
  /** Conta contábil FL sugerida (nome + número do plano do guia FL). */
  glAccount: string;
  /** Tipo de lançamento a criar no QBO para casar a transação. */
  entryType: FlEntryType;
  /** direção contábil: entrada (crédito no banco) ou saída (débito no banco). */
  direction: 'in' | 'out';
  /** Justificativa da regra da Flórida. */
  rule: string;
  confidence: FlConfidence;
  /** true quando pode entrar no lote de auto-aplicação (alta confiança). */
  autoApply: boolean;
}

const RX = {
  utility: /\b(teco|toho|duke|fpl|kua|oucc|ferc|water|sewer|electric|utility|utilit|garbage|waste|spectrum|comcast|frontier|at&t|centurylink)\b/i,
  hoa: /\b(hoa|home ?owners|association|condo|master assoc)\b/i,
  insurance: /\b(insurance|geico|state ?farm|allstate|progressive|flood|nfip|citizens|universal prop)\b/i,
  bankFee: /\b(service charge|monthly fee|maintenance fee|nsf|overdraft|wire fee|analysis charge|returned item)\b/i,
  transfer: /\b(online transfer|transfer to|transfer from|book transfer|xfer|internal transfer|to checking|to savings)\b/i,
  securityVendor: /\b(a ?l ?security|adt|alarm|security)\b/i,
  maintenance: /\b(plumb|hvac|a\/c|air cond|repair|handyman|clean|lawn|landscap|pool|pest|roof|paint|appliance|home depot|lowe'?s)\b/i,
  mgmtFee: /\b(management fee|mgmt fee|mgmt|admin fee)\b/i,
  ownerDist: /\b(owner|distribution|payout|repasse|disburs)\b/i,
  rentIn: /\b(rent|zelle|deposit|receipt|payment received|appfolio|cozy|rentpayment|ach credit)\b/i,
  payrollTax: /\b(irs|dor|payroll|tax|941|940|dept of revenue)\b/i,
};

/**
 * Classifica UMA transação. amount: positivo = crédito no banco (entrada); negativo = débito (saída).
 */
export function flReconcilePlan(description: string, amount: number, bankAccountKey: FlAccountKey): FlReconcilePlan {
  const d = String(description || '');
  const isIn = amount >= 0;
  const dir: 'in' | 'out' = isIn ? 'in' : 'out';

  // ---- Conta de CAUÇÃO (Security Deposit): tudo é passivo, nunca receita ----
  if (bankAccountKey === 'DEPOSIT_SECURITY') {
    return {
      category: isIn ? 'Security Deposit recebido' : 'Security Deposit devolvido/aplicado',
      glAccount: '2100 Security Deposits Held (Liability)',
      entryType: isIn ? 'deposit' : 'purchase',
      direction: dir,
      rule: 'FREC 61J2-14: caução é trust money e passivo (2100) — nunca receita, nunca na Operating.',
      confidence: 'high',
      autoApply: true,
    };
  }

  // ---- Conta TRUST (dinheiro de terceiros): aluguéis a repassar / repasse / mgmt fee ----
  if (bankAccountKey === 'TRUST_CHASE') {
    if (isIn) {
      return {
        category: 'Aluguel recebido (Trust)',
        glAccount: '2200 Owner Distribution Payable / Rent recebido (trust liability)',
        entryType: 'deposit',
        direction: dir,
        rule: 'Aluguel do inquilino entra na Trust como passivo a repassar (não é receita da empresa até a mgmt fee).',
        confidence: 'high',
        autoApply: true,
      };
    }
    if (RX.mgmtFee.test(d)) {
      return { category: 'Management fee (Trust→Operating)', glAccount: '4100 Property Management Fees (Income)', entryType: 'transfer', direction: dir, rule: 'Mgmt fee sai da Trust para a Operating e vira receita (4100).', confidence: 'high', autoApply: true };
    }
    return {
      category: 'Repasse ao owner',
      glAccount: '2200 Owner Distribution Payable (Liability)',
      entryType: 'purchase',
      direction: dir,
      rule: 'Saída da Trust para o proprietário quita o passivo de repasse (2200), não é despesa.',
      confidence: 'high',
      autoApply: true,
    };
  }

  // ---- Conta OPERATING (dinheiro da empresa) ----
  if (RX.transfer.test(d)) {
    return { category: 'Transferência entre contas', glAccount: 'Transfer (entre 6352/7236/7509)', entryType: 'transfer', direction: dir, rule: 'Transferência interna — casar como Transfer; verificar se preserva a separação Operating/Trust.', confidence: 'high', autoApply: true };
  }
  if (RX.bankFee.test(d)) {
    return { category: 'Tarifa bancária', glAccount: '6xxx Bank Service Charges (Expense)', entryType: 'purchase', direction: 'out', rule: 'Tarifa da conta Operating é despesa da empresa.', confidence: 'high', autoApply: true };
  }
  if (RX.utility.test(d)) {
    return { category: 'Utilities', glAccount: '6xxx Utilities (Expense) — verificar se é owner-billable', entryType: 'purchase', direction: 'out', rule: 'Utilities: despesa; se o lease diz que o inquilino/owner paga, faturar (billable). Não é trust money.', confidence: 'high', autoApply: true };
  }
  if (RX.hoa.test(d)) {
    return { category: 'HOA', glAccount: '6xxx HOA (Expense) — normalmente owner-billable', entryType: 'purchase', direction: 'out', rule: 'HOA em geral é do owner (billable). Despesa na Operating; repassar/faturar ao owner.', confidence: 'high', autoApply: true };
  }
  if (RX.insurance.test(d)) {
    return { category: 'Seguro', glAccount: '6xxx Insurance (Expense)', entryType: 'purchase', direction: 'out', rule: 'Seguro: despesa; owner-billable se for do imóvel do proprietário.', confidence: 'medium', autoApply: false };
  }
  if (RX.payrollTax.test(d)) {
    return { category: 'Imposto/folha', glAccount: '2xxx Payroll/Tax Liabilities', entryType: 'purchase', direction: dir, rule: 'IRS/DOR/folha: passivo/imposto da empresa, conta Operating.', confidence: 'medium', autoApply: false };
  }
  if (RX.securityVendor.test(d) || RX.maintenance.test(d)) {
    return { category: 'Manutenção/Vendor', glAccount: '6xxx Repairs & Maintenance (Expense) — owner-billable', entryType: 'purchase', direction: 'out', rule: 'Manutenção: despesa; se do imóvel do owner, billable ao owner.', confidence: 'medium', autoApply: false };
  }
  if (RX.mgmtFee.test(d)) {
    return { category: 'Management fee (receita)', glAccount: '4100 Property Management Fees (Income)', entryType: 'deposit', direction: 'in', rule: 'Mgmt fee é receita da empresa (4100) na Operating.', confidence: 'medium', autoApply: false };
  }
  if (isIn && RX.rentIn.test(d)) {
    return { category: 'Entrada — verificar (aluguel?)', glAccount: '⚠ Rent deveria ir na Trust (7236), não na Operating', entryType: 'deposit', direction: 'in', rule: 'ALERTA FL: aluguel é trust money e não pode entrar na Operating (co-mingling). Verificar/reclassificar.', confidence: 'low', autoApply: false };
  }

  // Fallback
  return {
    category: isIn ? 'Entrada não categorizada' : 'Saída não categorizada',
    glAccount: 'Uncategorized — revisar manualmente',
    entryType: isIn ? 'deposit' : 'purchase',
    direction: dir,
    rule: 'Sem regra clara pela descrição — revisar manualmente antes de conciliar.',
    confidence: 'low',
    autoApply: false,
  };
}
