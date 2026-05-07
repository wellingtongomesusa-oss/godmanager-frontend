export function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[#,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const distance = levenshtein(longer, shorter);
  return (longer.length - distance) / longer.length;
}

export interface PropertyLite {
  id: string;
  address: string;
}

export interface TenantLite {
  id: string;
  name: string;
  propertyId: string | null;
}

export function matchProperty(paymentAddress: string, properties: PropertyLite[]): string | null {
  const parts = paymentAddress
    .split(' - ')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const normalizedPart = normalizeAddress(part);
    const matches = properties.filter((p) => normalizeAddress(p.address) === normalizedPart);
    if (matches.length === 1) return matches[0]!.id;
  }
  return null;
}

export function matchTenant(
  payerName: string,
  tenants: TenantLite[],
  propertyId: string | null,
): string | null {
  if (!propertyId) return null;
  const candidates = tenants.filter((t) => t.propertyId === propertyId);
  if (candidates.length === 0) return null;
  const normalizedPayer = payerName.toLowerCase().trim();
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const score = similarity(normalizedPayer, c.name.toLowerCase().trim());
    if (score >= 0.85 && (!best || score > best.score)) {
      best = { id: c.id, score };
    }
  }
  return best ? best.id : null;
}
