'use client';

/**
 * Substitui o root layout quando há erro nele.
 * Deve incluir <html> e <body> (requisito Next.js).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Erro crítico</h1>
        <p style={{ color: '#444', fontSize: 14 }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: '10px 16px',
            cursor: 'pointer',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: '#111',
            color: '#fff',
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
