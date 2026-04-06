import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    products: [
      { href: '/seguros-de-vida', label: 'Life Insurance' },
      { href: '/llc-florida', label: 'Florida LLC' },
      { href: '/pagamentos-internacionais', label: 'International Payments' },
      { href: '/godroox-mail', label: 'Godroox Mail' },
    ],
    company: [
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contato' },
      { href: '/careers', label: 'Careers' },
      { href: '/blog', label: 'Blog' },
    ],
    partners: [
      { href: '/parceiros', label: 'Partner Program' },
      { href: '/parceiros/api', label: 'API Documentation' },
      { href: '/parceiros/integration', label: 'Integration Guide' },
    ],
    legal: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/security', label: 'Security' },
    ],
  };

  return (
    <footer className="border-t border-secondary-200 bg-secondary-50">
      <div className="container-custom py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-xl">
                G
              </div>
              <span className="text-xl font-bold text-secondary-900">
                Godroox
              </span>
            </Link>
            <p className="text-sm text-secondary-600 mb-4">
              Modern fintech platform for life insurance, LLC formation, and
              international payments.
            </p>
            <div className="text-sm text-secondary-600">
              <p className="font-semibold mb-1">Email:</p>
              <a
                href="mailto:contact@godroox.com"
                className="text-primary-600 hover:text-primary-700 transition-colors"
              >
                contact@godroox.com
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-4">
              Products
            </h3>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Partners & Legal */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-sm font-semibold text-secondary-900 mb-4">
              Partners
            </h3>
            <ul className="space-y-3 mb-6">
              {footerLinks.partners.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="text-sm font-semibold text-secondary-900 mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-secondary-200 pt-8">
          <p className="text-sm text-secondary-600 text-center">
            © {currentYear} Godroox. All rights reserved.
          </p>
          <p className="text-xs text-secondary-400 text-center mt-2">
            <strong>Important:</strong> Godroox is not a bank. Banking services are provided by our partner financial institutions.
          </p>
        </div>
      </div>
    </footer>
  );
}
