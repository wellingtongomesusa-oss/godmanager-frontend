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

/** Conta do QuickBooks (subconjunto do QbAccount) usada só para o mapeamento. */
export interface QboAccountLite {
  id: string;
  name: string;
  acctNum: string;
  classification: string;
  accountType: string;
}

/**
 * Mapeia o plano FL para uma conta REAL do plano de contas do QuickBooks do cliente.
 * Prioridade: (1) número de conta do guia FL (2100/2200/4100…), (2) palavra-chave + classificação.
 * Retorna null quando não há candidata clara (o usuário escolhe na tela For Review).
 */
/** Chave canônica da categoria FL (para o mapa manual de contas do cliente). '' = não mapeável. */
export function flKeyOf(plan: FlReconcilePlan): string {
  const c = plan.category.toLowerCase();
  if (/repasse ao owner/.test(c)) return 'owner_distribution';
  if (/aluguel recebido/.test(c)) return 'rent_trust';
  if (/security deposit recebido/.test(c)) return 'security_deposit_in';
  if (/security deposit devolvido/.test(c)) return 'security_deposit_out';
  if (/management fee/.test(c)) return 'mgmt_fee';
  if (/utilities/.test(c)) return 'utilities';
  if (/^hoa$/.test(c) || /\bhoa\b/.test(c)) return 'hoa';
  if (/manuten|vendor/.test(c)) return 'maintenance';
  if (/tarifa banc/.test(c)) return 'bank_fee';
  return '';
}

/**
 * Resolve a conta contábil. Se `savedCat` (mapa manual: flKey → qboAccountId) tiver a categoria,
 * usa a conta escolhida pelo cliente (fonte de verdade). Senão, tenta o palpite por número/nome.
 */
export function resolveQboAccount(plan: FlReconcilePlan, accounts: QboAccountLite[], savedCat?: Record<string, string> | null): QboAccountLite | null {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;

  // 0) mapa manual do cliente (prioridade máxima)
  if (savedCat) {
    const k = flKeyOf(plan);
    const id = k ? savedCat[k] : '';
    if (id) { const a = accounts.find((x) => x.id === id); if (a) return a; }
  }

  // 1) casar pelo número de conta presente no glAccount (ex.: "2100 Security Deposits…")
  const num = (plan.glAccount.match(/\b(\d{3,5})\b/) || [])[1] || '';
  if (num) {
    const byNum = accounts.find((a) => a.acctNum && a.acctNum === num);
    if (byNum) return byNum;
  }

  // 2) casar por palavra-chave + classificação contábil
  const KW: Array<{ when: RegExp; name: RegExp; cls?: string }> = [
    { when: /security deposit/i, name: /security deposit|tenant deposit|deposits? held|caução/i, cls: 'Liability' },
    { when: /owner distribution|repasse/i, name: /owner|distribution|due to owner|payable to owner|repasse/i, cls: 'Liability' },
    { when: /management fee|property management/i, name: /management fee|property management|mgmt/i, cls: 'Revenue' },
    { when: /rent recebido|rent \(trust|aluguel/i, name: /rent|tenant|aluguel/i, cls: 'Liability' },
    { when: /utilit/i, name: /utilit|electric|water|sewer|power|energy/i, cls: 'Expense' },
    { when: /hoa/i, name: /hoa|association|condo/i, cls: 'Expense' },
    { when: /insurance/i, name: /insurance/i, cls: 'Expense' },
    { when: /repairs|maintenance/i, name: /repair|maintenance|r ?& ?m|handyman/i, cls: 'Expense' },
    { when: /bank service charge|bank charge|tarifa/i, name: /bank (charge|fee|service)|service charge|merchant fee/i, cls: 'Expense' },
    { when: /payroll|tax|imposto/i, name: /payroll|tax|imposto/i },
  ];
  for (const r of KW) {
    if (r.when.test(plan.glAccount) || r.when.test(plan.category)) {
      const cand = accounts.filter((a) => (!r.cls || a.classification === r.cls) && r.name.test(a.name));
      if (cand.length) {
        // prefere a conta com número (plano estruturado) e nome mais curto (mais específico)
        cand.sort((a, b) => (b.acctNum ? 1 : 0) - (a.acctNum ? 1 : 0) || a.name.length - b.name.length);
        return cand[0];
      }
      return null; // categoria reconhecida, mas sem conta correspondente no plano do cliente
    }
  }
  return null;
}

/** last4 de cada conta bancária Chase (papel → final do número). Ver memória chase-contas-mapa. */
export const FL_BANK_LAST4: Record<string, string> = {
  OPERATING_TRUST: '6352',
  TRUST_CHASE: '7236',
  DEPOSIT_SECURITY: '7509',
};

/**
 * Encontra a CONTA BANCÁRIA no QuickBooks correspondente à conta Chase (por last4 no número/nome).
 * Só considera contas do tipo Bank. Retorna null se não achar (o robô então NÃO escreve — segurança).
 */
export function resolveQboBankAccount(bankAccountKey: FlAccountKey, accounts: QboAccountLite[], savedBank?: Record<string, string> | null): QboAccountLite | null {
  if (!Array.isArray(accounts)) return null;
  // 0) mapa manual do cliente
  if (savedBank && savedBank[bankAccountKey]) {
    const a = accounts.find((x) => x.id === savedBank[bankAccountKey]);
    if (a) return a;
  }
  const last4 = FL_BANK_LAST4[bankAccountKey];
  if (!last4) return null;
  const banks = accounts.filter((a) => /bank/i.test(a.accountType));
  const byNum = banks.find((a) => a.acctNum && a.acctNum.replace(/\D/g, '').endsWith(last4));
  if (byNum) return byNum;
  const byName = banks.find((a) => a.name.replace(/\D/g, '').includes(last4));
  return byName || null;
}

export interface FlValidation {
  ok: boolean;
  reason?: string;
  checks: string[];
}

/**
 * VALIDAÇÃO DE CONFORMIDADE FL — trava anti-erro (FREC 61J2-14 / Ch. 475 F.S.).
 * Bloqueia o lançamento se qualquer invariante de trust accounting não bater. O robô só grava no
 * QuickBooks quando isto retorna ok=true. É a proteção que impede posting errado antes da auditoria.
 */
export function flValidateEntry(
  plan: FlReconcilePlan,
  flAccount: QboAccountLite | null,
  bankAccount: QboAccountLite | null,
  bankAccountKey: FlAccountKey,
  amount: number,
): FlValidation {
  const checks: string[] = [];
  const fail = (reason: string): FlValidation => ({ ok: false, reason, checks });

  if (!flAccount) return fail('Conta contábil FL não mapeada no QuickBooks.');
  if (!bankAccount) return fail('Conta bancária não mapeada no QuickBooks.');

  // 1) Classificação esperada da conta contábil (caução/repasse=Liability, mgmt fee=Revenue, despesa=Expense).
  const gl = plan.glAccount.toLowerCase();
  let expectedCls: string | null = null;
  if (/security deposit|2100/.test(gl)) expectedCls = 'Liability';
  else if (/owner distribution|2200|rent|aluguel/.test(gl)) expectedCls = 'Liability';
  else if (/management fee|4100|income|receita/.test(gl)) expectedCls = 'Revenue';
  else if (/expense|utilit|hoa|insurance|repair|maintenance|bank (charge|fee|service)|despesa|tarifa/.test(gl)) expectedCls = 'Expense';
  const cls = String(flAccount.classification || '');
  if (expectedCls && cls && cls !== expectedCls) {
    return fail(`Classificação divergente: esperado ${expectedCls}, mas '${flAccount.name}' é ${cls}.`);
  }
  checks.push(`classe ${cls || '?'} = ${expectedCls || 'n/a'} OK`);

  // 2) Separação de contas (trust accounting): o banco tem que ser o do papel da transação.
  const expLast4 = FL_BANK_LAST4[bankAccountKey];
  const bankDigits = String(bankAccount.acctNum || bankAccount.name || '').replace(/\D/g, '');
  if (expLast4 && bankDigits && bankDigits.indexOf(expLast4) < 0) {
    return fail(`Conta bancária não corresponde ao papel (${bankAccountKey} deve terminar em ${expLast4}).`);
  }
  checks.push(`banco ${bankAccountKey} (final ${expLast4 || '?'}) OK`);

  // 3) Anti co-mingling: aluguel (trust money) NUNCA como receita na Operating.
  if (bankAccountKey === 'OPERATING_TRUST' && /rent|aluguel/.test(gl) && amount >= 0) {
    return fail('Co-mingling proibido: aluguel (trust money) não pode entrar como receita na conta Operating.');
  }
  checks.push('sem co-mingling');

  // 4) Direção contábil: entrada = Deposit, saída = Purchase.
  const isIn = amount >= 0;
  if (isIn && plan.entryType !== 'deposit') return fail('Entrada de caixa deve ser Deposit.');
  if (!isIn && plan.entryType !== 'purchase') return fail('Saída de caixa deve ser Purchase.');
  checks.push('direção contábil OK');

  // 5) Só grava alta confiança.
  if (!plan.autoApply) return fail('Confiança insuficiente para lançamento automático — revisar.');
  checks.push('alta confiança');

  return { ok: true, checks };
}
