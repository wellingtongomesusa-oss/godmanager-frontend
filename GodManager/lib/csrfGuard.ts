import { NextResponse } from 'next/server';

/**
 * Camada anti-CSRF por Origin/Referer (defense-in-depth, #43).
 *
 * O cookie de sessão já é HMAC-assinado, httpOnly, secure e SameSite=Lax — o Lax por si só
 * bloqueia o envio do cookie em POST cross-site. Este guarda é a 2ª camada: rejeita
 * explicitamente qualquer requisição MUTANTE (POST/PATCH/PUT/DELETE) cuja Origin (ou Referer,
 * como fallback) não seja a própria origem nem um host explicitamente permitido.
 *
 * Regras de segurança/compatibilidade:
 *  - GET/HEAD/OPTIONS passam sempre (não mutam estado).
 *  - Sem Origin E sem Referer → passa (cliente não-browser: curl/app/servidor; a sessão é o gate).
 *    Navegadores SEMPRE enviam Origin em fetch/XHR mutante, então ataques cross-site caem aqui.
 *  - Opt-in por rota. NUNCA aplicar a webhooks (Plaid/Stripe/Twilio/QuickBooks) — são
 *    cross-origin legítimos. Aplicar só a endpoints chamados pelo próprio SPA.
 *
 * Uso:
 *   const bad = csrfGuard(req); if (bad) return bad;
 */
function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(req.url).host);
  } catch {
    /* ignore */
  }
  // Domínios de produção conhecidos + extras via env (CSRF_ALLOWED_ORIGINS="https://a.com,https://b.com").
  for (const h of ['godmanager.us', 'www.godmanager.us']) hosts.add(h);
  const extra = String(process.env.CSRF_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of extra) {
    try {
      hosts.add(new URL(o).host);
    } catch {
      hosts.add(o);
    }
  }
  return hosts;
}

/** Retorna uma resposta 403 se a Origin for cross-site em requisição mutante; caso contrário null. */
export function csrfGuard(req: Request): NextResponse | null {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  let host: string | null = null;
  if (origin) {
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
  } else if (referer) {
    try {
      host = new URL(referer).host;
    } catch {
      host = null;
    }
  }
  // Sem cabeçalho de origem → não é um navegador fazendo cross-site; deixa a sessão decidir.
  if (!host) return null;
  if (allowedHosts(req).has(host)) return null;
  return NextResponse.json({ ok: false, error: 'Origem não autorizada.' }, { status: 403 });
}
