import Link from 'next/link';

type Active = 'home' | 'services' | 'about' | 'contact';

const linkBase = {
  textDecoration: 'none',
  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
  fontSize: 13,
  letterSpacing: '0.5px',
} as const;

function navStyle(isActive: boolean): React.CSSProperties {
  return {
    ...linkBase,
    color: isActive ? '#fff' : '#e5e7eb',
    fontWeight: isActive ? 600 : 400,
  };
}

export function SiteHeader({ active }: { active: Active }) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '14px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(201,169,110,0.2)',
      }}
    >
      <Link
        href="/login"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: '#c9a96e',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 18,
          }}
        >
          G
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              color: '#fff',
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            GodManager
          </span>
          <span
            style={{
              color: '#c9a96e',
              fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '2px',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            Financial Operations
          </span>
        </div>
      </Link>
      <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <Link href="/login" style={navStyle(active === 'home')}>
          Home
        </Link>
        <Link href="/services" style={navStyle(active === 'services')}>
          Servicos
        </Link>
        <Link href="/about" style={navStyle(active === 'about')}>
          Sobre nos
        </Link>
        <Link href="/contacto" style={navStyle(active === 'contact')}>
          Contacto
        </Link>
        <Link
          href="/request-demo"
          style={{
            background: '#c9a96e',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: 6,
            fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.5px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(201,169,110,0.3)',
            textDecoration: 'none',
          }}
        >
          Solicite o Demo
        </Link>
      </nav>
    </header>
  );
}
