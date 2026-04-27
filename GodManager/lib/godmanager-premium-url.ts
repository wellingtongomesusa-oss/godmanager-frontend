/**
 * URL do GodManager_Premium (public/) com ?v= opcional para cache-bust apos deploy.
 * NEXT_PUBLIC_APP_BUILD e preenchido no build (Vercel, Railway, SOURCE_VERSION) via next.config.js.
 */
export function getGodManagerPremiumUrl(): string {
  const v = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_BUILD) || '';
  if (v) {
    return `/GodManager_Premium.html?v=${encodeURIComponent(v)}`;
  }
  return '/GodManager_Premium.html';
}
