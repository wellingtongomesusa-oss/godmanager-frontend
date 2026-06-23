export const STATEMENT_CLOSED_ERROR = 'statement_closed';

export function isPayoutClosed(
  payout: { closedAt: Date | null } | null | undefined
): boolean {
  return !!(payout && payout.closedAt);
}
