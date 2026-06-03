/** Mesmas exclusoes que gmPropertiesFilterGhostRows no Premium. */
export function isGhostPortfolioProperty(p: {
  address?: string | null;
  code?: string | null;
  metadata?: unknown;
}): boolean {
  const meta =
    p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};
  const nm = String(meta.name || p.address || p.code || '')
    .trim()
    .toLowerCase();
  const addr = String(p.address || '').trim().toLowerCase();
  if (nm === 'total' || nm === 'manager prop') return true;
  if (addr === 'total' || addr.startsWith('admin -')) return true;
  return false;
}
