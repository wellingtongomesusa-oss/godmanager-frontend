/**
 * Parser do relatório "Delinquency" exportado do AppFolio (CSV).
 *
 * Formato típico:
 *   Unit,Name,Tenant Status,Tags,Phone Numbers,Move In,Move Out,Deposit,
 *   Amount Receivable,Delinquent Subsidy Amount,0-30,30+,Last Payment,Payment Amount,Late Count
 *   "-> 14688 Seton Creek Blvd - 14688 Seton Creek Blvd Winter Garden, FL 34787",...   (cabeçalho da casa)
 *   14688 Seton Creek Blvd,"da Costa, Amanda Marques",Current,...,"2,600.61",...        (linha de dados)
 *   Total,,,,...                                                                        (rodapé)
 *
 * Puro: sem dependências de banco. O casamento com propriedade/inquilino é feito na rota.
 */

export interface DelinquencyRow {
  unit: string;
  name: string;
  status: string;
  amountReceivable: number;
  past0_30: number;
  past30plus: number;
  lastPayment: string;
  lateCount: number;
}

/** Divide UMA linha de CSV em campos, respeitando aspas duplas e vírgulas internas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** "2,600.61" -> 2600.61 ; "" -> 0 */
function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseInt(String(raw).replace(/,/g, '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Faz o parse do CSV e retorna apenas as linhas de inquilino com valor a receber > 0.
 * Ignora cabeçalho, linhas de propriedade ("-> ...") e a linha Total.
 */
export function parseDelinquencyCsv(csv: string): DelinquencyRow[] {
  const lines = String(csv || '').split(/\r?\n/);
  const rows: DelinquencyRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const unit = (f[0] || '').trim();
    if (!unit) continue;
    if (unit === 'Unit') continue; // cabeçalho
    if (unit === 'Total') continue; // rodapé
    if (unit.startsWith('->')) continue; // cabeçalho da propriedade

    const name = (f[1] || '').trim();
    const status = (f[2] || '').trim();
    const amountReceivable = parseAmount(f[8]);
    const past0_30 = parseAmount(f[10]);
    const past30plus = parseAmount(f[11]);
    const lastPayment = (f[12] || '').trim();
    const lateCount = parseIntSafe(f[14]);

    // só interessa quem tem saldo a receber
    if (amountReceivable <= 0) continue;

    rows.push({
      unit,
      name,
      status,
      amountReceivable,
      past0_30,
      past30plus,
      lastPayment,
      lateCount,
    });
  }

  return rows;
}

/** Normaliza um endereço/unidade para casar CSV com Property.address (case/espaços/pontuação). */
export function normalizeUnitKey(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TenantLite {
  id: string;
  name: string;
  email: string | null;
  unit: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  propertyCode: string | null;
  status: string;
}

/** Tokens do nome (ignora vírgula de "Sobrenome, Nome") para desempate. */
function nameTokens(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Acha o melhor inquilino para uma linha do relatório, casando por unidade/endereço
 * e desempatando por nome. Retorna null se nada casar razoavelmente.
 */
export function matchTenantForRow(
  row: DelinquencyRow,
  tenants: TenantLite[],
): TenantLite | null {
  const csvKey = normalizeUnitKey(row.unit);
  if (!csvKey) return null;

  const candidates = tenants.filter((t) => {
    const keys = [t.unit, t.propertyAddress, t.propertyCode]
      .map((k) => normalizeUnitKey(k))
      .filter(Boolean);
    return keys.some(
      (k) => k === csvKey || k.startsWith(csvKey) || csvKey.startsWith(k),
    );
  });
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  // desempate: maior sobreposição de tokens do nome; preferir status ativo
  const csvNameTokens = nameTokens(row.name);
  let best: TenantLite | null = null;
  let bestScore = -1;
  for (const t of candidates) {
    const tks = nameTokens(t.name);
    const overlap = tks.filter((x) => csvNameTokens.includes(x)).length;
    const activeBonus = String(t.status).toLowerCase() === 'active' ? 0.5 : 0;
    const score = overlap + activeBonus;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
