/**
 * PmExpense.metadata.followUp — contrato de dados (sem migration).
 *
 * metadata.followUp = {
 *   stage: opened | maintenance_scheduled | closed_internal | vendor_requested |
 *          awaiting_quote | awaiting_vendor | vendor_done | followup_closed | escalated
 *   stageAt: ISO string
 *   stageBy: email | userId | 'auto'
 *   history: [{ stage, at, by, note? }]   // append-only
 *   assignees: string[]
 *   nextActionAt: ISO | null
 *   vendorQuote: { photoIds: string[], amount: number | null, receivedAt: ISO | null }
 *   autoRollover: { enabled: boolean, lastAt: ISO | null, count: number }
 *   alerts: [{ type, sentAt, channel }]
 * }
 *
 * Etapa default quando ausente: 'opened'.
 * Deep-merge apenas em metadata.followUp; demais chaves de metadata preservadas.
 */

export const FOLLOW_UP_STAGES = [
  'opened',
  'maintenance_scheduled',
  'closed_internal',
  'vendor_requested',
  'awaiting_quote',
  'awaiting_vendor',
  'vendor_done',
  'followup_closed',
  'escalated',
] as const;

export type FollowUpStage = (typeof FOLLOW_UP_STAGES)[number];

export const DEFAULT_FOLLOW_UP_STAGE: FollowUpStage = 'opened';

const STAGE_SET = new Set<string>(FOLLOW_UP_STAGES);

export class FollowUpMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FollowUpMergeError';
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

export function parseFollowUpStage(raw: unknown): FollowUpStage | null {
  const s = String(raw ?? '').trim();
  if (!s || !STAGE_SET.has(s)) return null;
  return s as FollowUpStage;
}

export function getFollowUpStage(metadata: unknown): FollowUpStage {
  const meta = asRecord(metadata);
  const fu = asRecord(meta?.followUp);
  return parseFollowUpStage(fu?.stage) ?? DEFAULT_FOLLOW_UP_STAGE;
}

function defaultFollowUpShell(
  at: string,
  by: string,
): Record<string, unknown> {
  return {
    stage: DEFAULT_FOLLOW_UP_STAGE,
    stageAt: at,
    stageBy: by,
    history: [],
    assignees: [],
    nextActionAt: null,
    vendorQuote: { photoIds: [], amount: null, receivedAt: null },
    autoRollover: { enabled: true, lastAt: null, count: 0 },
    alerts: [],
  };
}

function ensureFollowUpShell(
  curFu: Record<string, unknown>,
  at: string,
  by: string,
): Record<string, unknown> {
  const next = { ...curFu };
  if (!parseFollowUpStage(next.stage)) {
    next.stage = DEFAULT_FOLLOW_UP_STAGE;
    if (next.stageAt == null) next.stageAt = at;
    if (next.stageBy == null) next.stageBy = by;
  }
  if (!Array.isArray(next.history)) next.history = [];
  if (!Array.isArray(next.assignees)) next.assignees = [];
  if (next.nextActionAt === undefined) next.nextActionAt = null;
  if (!asRecord(next.vendorQuote)) {
    next.vendorQuote = { photoIds: [], amount: null, receivedAt: null };
  }
  if (!asRecord(next.autoRollover)) {
    next.autoRollover = { enabled: true, lastAt: null, count: 0 };
  }
  if (!Array.isArray(next.alerts)) next.alerts = [];
  return next;
}

/**
 * Deep-merge somente metadata.followUp; preserva todas as outras chaves de metadata.
 * stage/stageAt/stageBy vêm da sessão (opts.by / opts.at), nunca do cliente.
 * history: append-only quando stage muda.
 */
export function mergeFollowUpMetadata(
  existingMeta: unknown,
  patch: unknown,
  opts: { by: string; at?: string },
): Record<string, unknown> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new FollowUpMergeError('followUp patch must be an object');
  }

  const patchObj = patch as Record<string, unknown>;
  const at = opts.at ?? new Date().toISOString();
  const by = String(opts.by || '').trim() || 'unknown';

  const base = asRecord(existingMeta) ? { ...(existingMeta as Record<string, unknown>) } : {};
  const curFuRaw = asRecord(base.followUp);
  let nextFu = ensureFollowUpShell(
    curFuRaw ? { ...curFuRaw } : defaultFollowUpShell(at, by),
    at,
    by,
  );

  if ('stage' in patchObj && patchObj.stage !== undefined) {
    const stage = parseFollowUpStage(patchObj.stage);
    if (!stage) {
      throw new FollowUpMergeError(`Invalid followUp stage: ${String(patchObj.stage)}`);
    }
    nextFu.stage = stage;
    nextFu.stageAt = at;
    nextFu.stageBy = by;

    const history = Array.isArray(nextFu.history) ? [...(nextFu.history as unknown[])] : [];
    const note =
      patchObj.note !== undefined && patchObj.note !== null ? String(patchObj.note) : undefined;
    const entry: Record<string, unknown> = { stage, at, by };
    if (note !== undefined) entry.note = note;
    history.push(entry);
    nextFu.history = history;
  }

  if ('assignees' in patchObj && patchObj.assignees !== undefined) {
    if (!Array.isArray(patchObj.assignees)) {
      throw new FollowUpMergeError('assignees must be an array');
    }
    const existing = Array.isArray(nextFu.assignees)
      ? (nextFu.assignees as unknown[]).map(String)
      : [];
    const added = patchObj.assignees.map(String);
    nextFu.assignees = [...new Set([...existing, ...added])];
  }

  if ('nextActionAt' in patchObj) {
    nextFu.nextActionAt =
      patchObj.nextActionAt === null || patchObj.nextActionAt === ''
        ? null
        : String(patchObj.nextActionAt);
  }

  if ('vendorQuote' in patchObj && patchObj.vendorQuote !== undefined) {
    const vqPatch = asRecord(patchObj.vendorQuote);
    if (!vqPatch) throw new FollowUpMergeError('vendorQuote must be an object');
    const vqBase = asRecord(nextFu.vendorQuote) ?? {
      photoIds: [],
      amount: null,
      receivedAt: null,
    };
    const merged: Record<string, unknown> = { ...vqBase };
    if ('photoIds' in vqPatch) {
      if (!Array.isArray(vqPatch.photoIds)) {
        throw new FollowUpMergeError('vendorQuote.photoIds must be an array');
      }
      const existingIds = Array.isArray(merged.photoIds)
        ? (merged.photoIds as unknown[]).map(String)
        : [];
      merged.photoIds = [...new Set([...existingIds, ...vqPatch.photoIds.map(String)])];
    }
    if ('amount' in vqPatch) merged.amount = vqPatch.amount;
    if ('receivedAt' in vqPatch) merged.receivedAt = vqPatch.receivedAt;
    nextFu.vendorQuote = merged;
  }

  if ('autoRollover' in patchObj && patchObj.autoRollover !== undefined) {
    const arPatch = asRecord(patchObj.autoRollover);
    if (!arPatch) throw new FollowUpMergeError('autoRollover must be an object');
    const arBase = asRecord(nextFu.autoRollover) ?? { enabled: true, lastAt: null, count: 0 };
    nextFu.autoRollover = { ...arBase, ...arPatch };
  }

  if ('alerts' in patchObj && patchObj.alerts !== undefined) {
    if (!Array.isArray(patchObj.alerts)) {
      throw new FollowUpMergeError('alerts must be an array');
    }
    const existing = Array.isArray(nextFu.alerts) ? [...(nextFu.alerts as unknown[])] : [];
    nextFu.alerts = [...existing, ...patchObj.alerts];
  }

  base.followUp = nextFu;
  return base;
}
