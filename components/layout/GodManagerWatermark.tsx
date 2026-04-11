export function GodManagerWatermark() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <span
        className="absolute bottom-6 right-6 font-heading text-[13px] text-gm-amber/[0.12]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        godmanager.com
      </span>
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] font-heading text-[120px] leading-none text-gm-amber/[0.03]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        godmanager.com
      </span>
    </div>
  );
}
