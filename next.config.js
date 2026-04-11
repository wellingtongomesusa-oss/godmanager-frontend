/** @type {import('next').NextConfig} */
const crmBackend =
  process.env.CRM_BACKEND_URL || process.env.NEXT_PUBLIC_CRM_BACKEND_URL || 'http://127.0.0.1:5001';

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/manager-pro/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate, max-age=0' },
        ],
      },
      {
        source: '/GodManager_Premium.html',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate, max-age=0' },
        ],
      },
    ];
  },
  /**
   * Mesma origem na porta do Next (ex.: 3101): /crm/* e APIs do CRM Flask passam pelo proxy.
   * O servidor Flask deve estar a correr (ex.: run_crm_manager_prop.py na 5001), salvo outro CRM_BACKEND_URL.
   */
  async rewrites() {
    const b = crmBackend.replace(/\/$/, '');
    return [
      { source: '/crm/:path*', destination: `${b}/crm/:path*` },
      { source: '/api/integrations/:path*', destination: `${b}/api/integrations/:path*` },
      { source: '/api/webhooks/:path*', destination: `${b}/api/webhooks/:path*` },
      { source: '/api/quickbooks/:path*', destination: `${b}/api/quickbooks/:path*` },
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
    }
    return config;
  },
};

module.exports = nextConfig;
