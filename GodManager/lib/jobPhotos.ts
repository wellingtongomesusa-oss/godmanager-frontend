export const MAX_PHOTOS_PER_JOB = 20;
export const MAX_VIDEOS_PER_JOB = 1;
export const MAX_CONTAINERS_PER_JOB = 5;

// Limites por midia. Video ~3 min (duracao validada no browser; tamanho e a rede de seguranca no servidor).
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB (~3 min)
export const MAX_VIDEO_DURATION_SECONDS = 180; // 3 min

export const ALLOWED_PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const ALLOWED_VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;

export function isVideoContentType(ct: string): boolean {
  return (ALLOWED_VIDEO_CONTENT_TYPES as readonly string[]).includes(ct);
}
export function isPhotoContentType(ct: string): boolean {
  return (ALLOWED_PHOTO_CONTENT_TYPES as readonly string[]).includes(ct);
}

export function parseContainerNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 1;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > MAX_CONTAINERS_PER_JOB) return null;
  return n;
}

export function jobPhotoR2KeyPrefix(
  clientId: string | null,
  jobId: string,
  containerNumber: number,
): string {
  return `job-photos/${clientId || 'no-client'}/${jobId}/c${containerNumber}/`;
}

/** Validates upload key for the given job and container (supports legacy keys for container 1). */
export function validateJobPhotoR2Key(
  r2Key: string,
  clientId: string | null,
  jobId: string,
  containerNumber: number,
): boolean {
  if (!r2Key.startsWith('job-photos/') || r2Key.includes('..') || r2Key.includes('//')) {
    return false;
  }
  const scopedPrefix = jobPhotoR2KeyPrefix(clientId, jobId, containerNumber);
  if (r2Key.startsWith(scopedPrefix)) return true;
  if (containerNumber !== 1) return false;
  const legacyPrefix = `job-photos/${clientId || 'no-client'}/${jobId}/`;
  if (!r2Key.startsWith(legacyPrefix)) return false;
  const rest = r2Key.slice(legacyPrefix.length);
  return !/^c[1-5]\//.test(rest);
}
