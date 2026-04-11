'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createLinkId,
  DEFAULT_LINK_ICON,
  loadLicenseLinks,
  saveLicenseLinks,
  type LicenseUsefulLink,
} from '@/lib/manager-pro/licensesModule';

type Props = {
  marginTopPx?: number;
};

export function LicensesUsefulLinks({ marginTopPx = 32 }: Props) {
  const [links, setLinks] = useState<LicenseUsefulLink[]>([]);
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LicenseUsefulLink | null>(null);
  const [form, setForm] = useState({
    linkTitle: '',
    linkSubtitle: '',
    linkUrl: '',
    linkIcon: DEFAULT_LINK_ICON,
  });

  const listRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<{ destroy: () => void } | null>(null);
  const linksRef = useRef<LicenseUsefulLink[]>([]);
  linksRef.current = links;

  const persist = useCallback((next: LicenseUsefulLink[]) => {
    setLinks(next);
    saveLicenseLinks(next);
  }, []);

  const linkOrderKey = useMemo(() => links.map((l) => l.id).join('|'), [links]);

  useEffect(() => {
    setMounted(true);
    try {
      setLinks(loadLicenseLinks());
    } catch {
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const teardown = () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };

    if (!mounted || !listRef.current || linksRef.current.length === 0) {
      teardown();
      return;
    }

    teardown();

    import('sortablejs')
      .then((mod) => {
        if (cancelled || !listRef.current) return;
        const Sortable = mod.default;
        sortableRef.current = Sortable.create(listRef.current!, {
          animation: 150,
          handle: '.license-link-drag',
          onEnd: () => {
            const el = listRef.current;
            if (!el) return;
            const order = [...el.querySelectorAll('[data-link-id]')]
              .map((n) => n.getAttribute('data-link-id'))
              .filter(Boolean) as string[];
            const cur = linksRef.current;
            const map = new Map(cur.map((l) => [l.id, l]));
            const next = order.map((id) => map.get(id)).filter(Boolean) as LicenseUsefulLink[];
            if (next.length === cur.length) {
              setLinks(next);
              saveLicenseLinks(next);
            }
          },
        });
      })
      .catch(() => {
        /* Sortable opcional — lista continua funcional sem drag */
      });

    return () => {
      cancelled = true;
      teardown();
    };
  }, [mounted, linkOrderKey]);

  useEffect(() => {
    const id = 'font-awesome-licenses';
    if (typeof document === 'undefined' || document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      linkTitle: '',
      linkSubtitle: '',
      linkUrl: 'https://',
      linkIcon: DEFAULT_LINK_ICON,
    });
    setModalOpen(true);
  };

  const openEdit = (row: LicenseUsefulLink) => {
    setEditing(row);
    setForm({
      linkTitle: row.linkTitle,
      linkSubtitle: row.linkSubtitle,
      linkUrl: row.linkUrl,
      linkIcon: row.linkIcon || DEFAULT_LINK_ICON,
    });
    setModalOpen(true);
  };

  const submitModal = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: LicenseUsefulLink = {
      id: editing?.id ?? createLinkId(),
      linkTitle: form.linkTitle.trim(),
      linkSubtitle: form.linkSubtitle.trim(),
      linkUrl: form.linkUrl.trim(),
      linkIcon: form.linkIcon.trim() || DEFAULT_LINK_ICON,
    };
    if (!payload.linkTitle || !payload.linkUrl) return;
    if (editing) {
      persist(links.map((l) => (l.id === editing.id ? payload : l)));
    } else {
      persist([...links, payload]);
    }
    setModalOpen(false);
  };

  const remove = (id: string) => {
    persist(links.filter((l) => l.id !== id));
  };

  return (
    <section style={{ marginTop: marginTopPx }} className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--ink)]">Links úteis</h2>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a4470]"
        >
          + Adicionar link
        </button>
      </div>
      <p className="mb-3 text-[11px] text-[var(--ink3)]">
        Arraste pelo ícone ⋮⋮ para reordenar (se o módulo carregar). Dados em localStorage.
      </p>

      {!mounted && <p className="text-xs text-[var(--ink3)]">Carregando…</p>}
      {mounted && links.length === 0 && (
        <p className="text-sm text-[var(--ink3)]">Nenhum link — use Adicionar link.</p>
      )}

      <div ref={listRef} className="flex flex-col gap-2">
        {links.map((l) => (
          <div
            key={l.id}
            data-link-id={l.id}
            className="flex items-stretch gap-2 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3"
          >
            <button
              type="button"
              className="license-link-drag cursor-grab touch-none px-1 text-[var(--ink3)] active:cursor-grabbing"
              aria-label="Arrastar"
            >
              ⋮⋮
            </button>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--paper)] text-lg text-[var(--ink2)]">
              <i className={l.linkIcon || DEFAULT_LINK_ICON} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--ink)]">{l.linkTitle}</p>
              <p className="text-xs text-[var(--ink2)]">{l.linkSubtitle}</p>
              <a
                href={l.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate text-xs text-[var(--blue)] hover:underline"
              >
                {l.linkUrl}
              </a>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => openEdit(l)}
                className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--ink)]"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-700"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitModal}
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {editing ? 'Editar link' : 'Adicionar link'}
            </h3>
            <div className="mt-3 space-y-2">
              <label className="block text-[11px] font-medium text-[var(--ink2)]">
                linkTitle
                <input
                  required
                  value={form.linkTitle}
                  onChange={(e) => setForm((f) => ({ ...f, linkTitle: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--ink2)]">
                linkSubtitle
                <input
                  value={form.linkSubtitle}
                  onChange={(e) => setForm((f) => ({ ...f, linkSubtitle: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--ink2)]">
                linkUrl
                <input
                  required
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--ink2)]">
                linkIcon (Font Awesome)
                <input
                  value={form.linkIcon}
                  onChange={(e) => setForm((f) => ({ ...f, linkIcon: e.target.value }))}
                  placeholder={DEFAULT_LINK_ICON}
                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 font-mono text-xs"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
              <button type="submit" className="rounded bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
