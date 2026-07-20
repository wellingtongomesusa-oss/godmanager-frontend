/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const crmBackend =
  process.env.CRM_BACKEND_URL || process.env.NEXT_PUBLIC_CRM_BACKEND_URL || 'http://127.0.0.1:5001';

const nextConfig = {
  /**
   * unpdf (pdf.js) é lib de servidor (leitura de PDF do Chase, #39): tratar como pacote externo
   * para não passar pelo bundle do Next e evitar quebra do pdf.js no server build.
   */
  experimental: {
    serverComponentsExternalPackages: ['unpdf'],
  },
  /**
   * Inlined em client: query ?v= em redirects para o HTML estatico (cache-bust no primeiro load apos deploy).
   */
  env: {
    NEXT_PUBLIC_APP_BUILD:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.SOURCE_VERSION ||
      process.env.NEXT_PUBLIC_APP_BUILD ||
      '',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
  async headers() {
    const noStoreHtml = [
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];
    return [
      {
        source: '/manager-pro/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate, max-age=0' },
        ],
      },
      {
        source: '/GodManager_Premium.html',
        headers: noStoreHtml,
      },
      {
        source: '/gm',
        headers: noStoreHtml,
      },
      {
        source: '/gm-premium',
        headers: noStoreHtml,
      },
      {
        source: '/gaap.html',
        headers: noStoreHtml,
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Permite so o que o app usa na propria origem (microfone p/ voz da SophIA,
            // geolocalizacao p/ execucao de Jobs) e bloqueia camera/pagamento/usb.
            key: 'Permissions-Policy',
            value: 'geolocation=(self), microphone=(self), camera=(), payment=(), usb=()',
          },
          {
            // CSP conservador (NAO define default-src/script-src, para nao quebrar os scripts inline
            // do monolito): bloqueia object/embed, sequestro de <base> e framing por terceiros
            // (anti-clickjacking, reforca o X-Frame-Options).
            key: 'Content-Security-Policy',
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
  /**
   * Mesma origem na porta do Next (ex.: 3101): /crm/* e APIs do CRM Flask passam pelo proxy.
   * ATENÇÃO: /api/quickbooks/* é NATIVO do Next.js (NÃO proxyar — o proxy engole o code/state
   * do OAuth callback). O legado /crm/integrations/quickbooks/* segue proxyado.
   * O servidor Flask deve estar a correr (ex.: run_crm_manager_prop.py na 5001), salvo outro CRM_BACKEND_URL.
   */
  async rewrites() {
    const b = crmBackend.replace(/\/$/, '');
    return [
      // NOTA: /api/quickbooks/* NÃO é mais proxyado ao Flask — o QuickBooks OAuth +
      // lançamentos são rotas nativas do Next.js (app/api/quickbooks/*). O proxy antigo
      // engolia o code/state do callback (ia p/ o backend legado 'godmanager', hoje caído).
      {
        source: '/crm/integrations/quickbooks/:path*',
        destination: `${b}/crm/integrations/quickbooks/:path*`,
      },
      { source: '/crm/:path*', destination: `${b}/crm/:path*` },
      { source: '/api/integrations/:path*', destination: `${b}/api/integrations/:path*` },
      { source: '/api/webhooks/:path*', destination: `${b}/api/webhooks/:path*` },
      { source: '/static/:path*', destination: `${b}/static/:path*` },
    ];
  },
  /**
   * Evita chunks Webpack órfãos (ex.: Cannot find module './682.js') quando o cache
   * incremental fica inconsistente durante o hot reload em dev.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
      // Ativar com GM_DEV_POLL_WATCH=1 se aparecer EMFILE no macOS (file watchers).
      if (process.env.GM_DEV_POLL_WATCH === '1') {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
          ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
        };
      }
    }
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
