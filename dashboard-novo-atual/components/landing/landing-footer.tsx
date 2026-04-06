'use client';

export function LandingFooter() {
  return (
    <footer className="border-t border-secondary-100 bg-white/60 py-5">
      <div className="container-custom">
        <p className="text-xs text-secondary-400">© {new Date().getFullYear()} Godroox</p>
      </div>
    </footer>
  );
}
