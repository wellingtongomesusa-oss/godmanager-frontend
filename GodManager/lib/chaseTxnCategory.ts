/**
 * Classifica uma transação do extrato Chase por TIPO, a partir da descrição, para os cards
 * de entradas/saídas por tipo na tela Statement (Zelle, ACH, Wire, Cartão, Transferência, Cheque).
 */
export const CHASE_TXN_TYPES = ['Zelle', 'Wire', 'Cartão', 'Transferência', 'ACH', 'Cheque', 'Outros'] as const;
export type ChaseTxnType = (typeof CHASE_TXN_TYPES)[number];

export function categorizeChaseTxn(description: string): ChaseTxnType {
  const d = String(description || '').toLowerCase();
  if (/zelle/.test(d)) return 'Zelle';
  if (/wire (transfer|reversal)|domestic wire|international wire/.test(d)) return 'Wire';
  if (/card purchase|recurring card|debit card/.test(d)) return 'Cartão';
  if (/book transfer|online transfer/.test(d)) return 'Transferência';
  if (/orig co name|:ccd|:ppd|\bach\b/.test(d)) return 'ACH';
  if (/\bcheck\b|check #/.test(d)) return 'Cheque';
  return 'Outros';
}
