export const BILLING_PARTY_VALUES = ['TENANT', 'OWNER', 'MANAGER_PROP'] as const;

export type BillingPartyValue = (typeof BILLING_PARTY_VALUES)[number];

export function parseBillingPartyField(
  value: unknown
): { value: string | null } | { error: string } | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return { value: null };
  const v = String(value).trim().toUpperCase();
  if (!BILLING_PARTY_VALUES.includes(v as BillingPartyValue)) {
    return { error: 'party must be TENANT, OWNER, or MANAGER_PROP' };
  }
  return { value: v };
}
