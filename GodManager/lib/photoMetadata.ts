/**
 * Defensive normalization for property metadata.photos array.
 * Accepts unknown input and returns a clean shape, dropping invalid entries.
 */

export type PhotoRef = {
  publicUrl: string;
  key: string;
  name: string;
  type: string;
  size: number;
  isPrimary: boolean;
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_PHOTOS = 20;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizePhoto(input: unknown): PhotoRef | null {
  if (!isPlainObject(input)) return null;
  const publicUrl = typeof input.publicUrl === 'string' ? input.publicUrl.trim() : '';
  const key = typeof input.key === 'string' ? input.key.trim() : '';
  if (!publicUrl || !key) return null;
  if (!publicUrl.startsWith('https://')) return null;
  if (!key.startsWith('properties/')) return null;
  if (key.includes('..') || key.includes('//')) return null;
  const type =
    typeof input.type === 'string' && ALLOWED_TYPES.has(input.type)
      ? input.type
      : 'image/jpeg';
  return {
    publicUrl,
    key,
    name: typeof input.name === 'string' ? input.name.slice(0, 200) : '',
    type,
    size:
      typeof input.size === 'number' && isFinite(input.size) && input.size >= 0
        ? Math.floor(input.size)
        : 0,
    isPrimary: input.isPrimary === true,
  };
}

/**
 * Normalizes the metadata object before persisting.
 * - Ensures metadata.photos is a clean array of PhotoRef
 * - Caps at MAX_PHOTOS
 * - Ensures at most one isPrimary
 * - Preserves all other metadata fields untouched
 */
export function normalizePropertyMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (metadata === undefined || metadata === null) return undefined;
  if (!isPlainObject(metadata)) return undefined;

  const out: Record<string, unknown> = { ...metadata };

  const photosRaw = (metadata as Record<string, unknown>).photos;
  if (Array.isArray(photosRaw)) {
    const cleaned: PhotoRef[] = [];
    for (const p of photosRaw) {
      const norm = normalizePhoto(p);
      if (norm) cleaned.push(norm);
      if (cleaned.length >= MAX_PHOTOS) break;
    }
    let primaryFound = false;
    for (const p of cleaned) {
      if (p.isPrimary && !primaryFound) {
        primaryFound = true;
      } else {
        p.isPrimary = false;
      }
    }
    if (!primaryFound && cleaned.length > 0) {
      cleaned[0].isPrimary = true;
    }
    out.photos = cleaned;
  } else if (photosRaw !== undefined) {
    out.photos = [];
  }

  const idx = (metadata as Record<string, unknown>).primaryPhotoIndex;
  if (typeof idx === 'number' && Number.isFinite(idx) && idx >= 0) {
    out.primaryPhotoIndex = Math.floor(idx);
  }

  return out;
}
