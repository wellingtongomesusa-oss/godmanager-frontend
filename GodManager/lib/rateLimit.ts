type AttemptRecord = { count: number; firstAttempt: number; blockedUntil: number };

const attempts = new Map<string, AttemptRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000; // 30 minutes

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const rec = attempts.get(key);

  if (!rec) return { allowed: true };
  if (rec.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rec.blockedUntil - now) / 1000),
    };
  }
  if (now - rec.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
    return;
  }
  rec.count++;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    rec.blockedUntil = now + BLOCK_MS;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
