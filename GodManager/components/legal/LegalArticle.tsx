const articleStyle: React.CSSProperties = {
  lineHeight: 1.7,
  fontSize: 15,
  color: 'var(--ink, #1f2937)',
};

export function LegalArticle({ children }: { children: React.ReactNode }) {
  return (
    <article className="legal-article font-body antialiased" style={articleStyle}>
      {children}
    </article>
  );
}
