/**
 * Airbnb — data em que o gross entra na conta (agregação por dia de crédito).
 *
 * Regra OBRIGATÓRIA (checkout → crédito):
 * - Seg checkout → Ter (+1)
 * - Ter checkout → Qua (+1)
 * - Qua checkout → Qui (+1)
 * - Qui checkout → Sex (+1)
 * - Sex checkout → Seg (+3)
 * - Sáb checkout → Ter (+3)
 * - Dom checkout → Ter (+2)
 * - Seg checkout → Ter (+1)  → Sáb+Dom+Seg somam no mesmo dia Ter (cada linha mapeada; a soma é por data de crédito)
 */
export function getPayoutCreditDate(checkout: Date): Date {
  const d = new Date(checkout.getFullYear(), checkout.getMonth(), checkout.getDate());
  const day = d.getDay();
  const add =
    day === 0 ? 2 : // Dom → Ter (+2)
    day === 1 ? 1 : // Seg → Ter (+1)
    day === 2 ? 1 : // Ter → Qua (+1)
    day === 3 ? 1 : // Qua → Qui (+1)
    day === 4 ? 1 : // Qui → Sex (+1)
    day === 5 ? 3 : // Sex → Seg (+3)
    3; // Sáb → Ter (+3)
  d.setDate(d.getDate() + add);
  return d;
}

/** Chave YYYY-MM-DD no fuso local (evita deslocar dia com toISOString/UTC). */
export function creditDateLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
