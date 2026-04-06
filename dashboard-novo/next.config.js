/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      { source: '/admin/dashboard', destination: '/admin/painel', permanent: true },
      { source: '/admin/open', destination: '/admin/cadastro', permanent: true },
    ];
  },
};

module.exports = nextConfig;
