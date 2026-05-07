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

export function tokenSimilarity(a: string, b: string): number {
  const split = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[\s,.\-#]+/)
        .filter((t) => t.length > 0),
    );
  const tokensA = split(a);
  const tokensB = split(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  return intersection / (tokensA.size + tokensB.size - intersection);
}

export interface PropertyLite {
  id: string;
  address: string;
}

export interface TenantLite {
  id: string;
  name: string;
  propertyId: string | null;
  moveIn?: Date | null;
  leaseTo?: Date | null;
  status?: string | null;
}

export function matchProperty(paymentAddress: string, properties: PropertyLite[]): string | null {
  const parts = paymentAddress
    .split(' - ')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const part of parts) {
    const normalizedPart = normalizeAddress(part);
    const matches = properties.filter((pr) => normalizeAddress(pr.address) === normalizedPart);
    if (matches.length === 1) return matches[0]!.id;
  }

  let best: { id: string; score: number } | null = null;
  for (const prop of properties) {
    const score = tokenSimilarity(paymentAddress, prop.address);
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { id: prop.id, score };
    }
  }
  return best ? best.id : null;
}

export function matchTenant(
  payerName: string,
  tenants: TenantLite[],
  propertyId: string | null,
): string | null {
  if (!propertyId) return null;
  const candidates = tenants.filter((t) => t.propertyId === propertyId);
  if (candidates.length === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const tokenScore = tokenSimilarity(payerName, c.name);
    const charScore = similarity(payerName.toLowerCase().trim(), c.name.toLowerCase().trim());
    const score = Math.max(tokenScore, charScore);
    if (score >= 0.75 && (!best || score > best.score)) {
      best = { id: c.id, score };
    }
  }
  return best ? best.id : null;
}

export function countActiveTenantsAtDate(
  paymentDate: Date,
  tenants: TenantLite[],
  propertyId: string | null,
): number {
  if (!propertyId) return 0;
  const candidates = tenants.filter((t) => t.propertyId === propertyId);
  return candidates.filter((t) => {
    const moveInOk = !t.moveIn || t.moveIn <= paymentDate;
    const leaseOk = !t.leaseTo || t.leaseTo >= paymentDate;
    const statusOk = !t.status || t.status === 'active';
    return moveInOk && leaseOk && statusOk;
  }).length;
}

export function matchTenantByDate(
  paymentDate: Date,
  tenants: TenantLite[],
  propertyId: string | null,
): string | null {
  if (!propertyId) return null;
  const candidates = tenants.filter((t) => t.propertyId === propertyId);
  if (candidates.length === 0) return null;

  const active = candidates.filter((t) => {
    const moveInOk = !t.moveIn || t.moveIn <= paymentDate;
    const leaseOk = !t.leaseTo || t.leaseTo >= paymentDate;
    const statusOk = !t.status || t.status === 'active';
    return moveInOk && leaseOk && statusOk;
  });

  const pick = (list: TenantLite[]) => {
    const sorted = [...list].sort(
      (a, b) => (b.moveIn?.getTime() ?? 0) - (a.moveIn?.getTime() ?? 0),
    );
    return sorted[0]?.id ?? null;
  };

  if (active.length > 0) return pick(active);
  return pick(candidates);
}
