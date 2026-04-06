'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '@/lib/manager-pro/auth';
import { formatRelativeTime, NEWS_LOCALE_KEY, newsStrings, type NewsLocale } from '@/lib/manager-pro/newsI18n';
import {
  departmentLabel,
  getNewsPdfBlob,
  listNewsPdfRecords,
  NEWS_DEPARTMENTS,
  type NewsDepartmentId,
  type NewsPdfRecord,
  saveNewsPdf,
  validatePdfFile,
} from '@/lib/manager-pro/newsPdfStore';
import { NEWS_MODULE_BUILD } from '@/lib/manager-pro/newsModuleVersion';
import {
  createMessage,
  loadTeamMessages,
  saveTeamMessages,
  type TeamCategory,
  type TeamMessage,
} from '@/lib/manager-pro/teamUpdatesStore';

const YOUTUBE_EMBED =
  'https://www.youtube.com/embed/live_stream?channel=UC4JRWRIBSfe5YghbkVBI7w&autoplay=1&mute=1&playsinline=1&rel=0';
const YOUTUBE_OPEN_URL = 'https://www.youtube.com/@BloombergTelevision/live';

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function useNyClock() {
  const [ny, setNy] = useState('');
  useEffect(() => {
    const fmt = () => {
      const s = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());
      setNy(s);
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return ny;
}

function initialNewsLocale(): NewsLocale {
  if (typeof window === 'undefined') return 'pt';
  const s = localStorage.getItem(NEWS_LOCALE_KEY);
  return s === 'en' ? 'en' : 'pt';
}

function formatUploadDate(iso: string, locale: NewsLocale) {
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function NewsPanelMasterOne() {
  const [locale, setLocale] = useState<NewsLocale>('pt');
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formAuthor, setFormAuthor] = useState('');
  const [formCat, setFormCat] = useState<TeamCategory>('general');
  const [formText, setFormText] = useState('');

  const [pdfRecords, setPdfRecords] = useState<NewsPdfRecord[]>([]);
  const [pdfDeptUpload, setPdfDeptUpload] = useState<NewsDepartmentId>('financeiro');
  const [pdfFilter, setPdfFilter] = useState<NewsDepartmentId | 'all'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewIdRef = useRef<string | null>(null);
  previewIdRef.current = previewId;

  const nyTime = useNyClock();
  const t = useMemo(() => newsStrings(locale), [locale]);

  const refreshPdfs = useCallback(async () => {
    const list = await listNewsPdfRecords();
    setPdfRecords(list);
    return list;
  }, []);

  useEffect(() => {
    setMounted(true);
    setLocale(initialNewsLocale());
    setMessages(loadTeamMessages());
    void refreshPdfs().then((list) => {
      if (list.length) setPreviewId((cur) => cur ?? list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init só ao montar
  }, [refreshPdfs]);

  useEffect(() => {
    if (!previewId || !mounted) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    const loadId = previewId;
    (async () => {
      const blob = await getNewsPdfBlob(loadId);
      if (cancelled || previewIdRef.current !== loadId) return;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (!blob) {
        setPreviewUrl(null);
        return;
      }
      const u = URL.createObjectURL(blob);
      previewUrlRef.current = u;
      setPreviewUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [previewId, mounted, pdfRecords]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    },
    []
  );

  const persist = useCallback((next: TeamMessage[]) => {
    setMessages(next);
    saveTeamMessages(next);
  }, []);

  const setNewsLang = (l: NewsLocale) => {
    setLocale(l);
    localStorage.setItem(NEWS_LOCALE_KEY, l);
  };

  const bumpReaction = (id: string, key: keyof TeamMessage['reactions']) => {
    const next = messages.map((m) =>
      m.id === id ? { ...m, reactions: { ...m.reactions, [key]: m.reactions[key] + 1 } } : m
    );
    persist(next);
  };

  const bumpRead = (id: string) => {
    const next = messages.map((m) => (m.id === id ? { ...m, reads: m.reads + 1 } : m));
    persist(next);
  };

  const onSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = createMessage(formAuthor, formCat, formText);
    if (!msg.text.trim()) return;
    persist([msg, ...messages]);
    setFormText('');
    setModalOpen(false);
  };

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [messages]
  );

  const filteredPdfs = useMemo(() => {
    if (pdfFilter === 'all') return pdfRecords;
    return pdfRecords.filter((r) => r.departamento === pdfFilter);
  }, [pdfRecords, pdfFilter]);

  const boardPdfs = useMemo(() => pdfRecords.slice(0, 8), [pdfRecords]);

  const processPdfFile = async (file: File) => {
    setPdfError(null);
    const v = validatePdfFile(file);
    if (!v.ok) {
      setPdfError(v.error);
      return;
    }
    setPdfBusy(true);
    try {
      const session = getSession();
      const user = session?.name || session?.email || '—';
      const rec = await saveNewsPdf(file, pdfDeptUpload, user);
      const list = await refreshPdfs();
      setPreviewId(rec.id);
      if (list[0]?.id === rec.id) {
        /* preview effect runs */
      }
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : t.pdfError);
    } finally {
      setPdfBusy(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void processPdfFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processPdfFile(f);
  };

  const openPreview = (id: string) => setPreviewId(id);

  const groupedByDept = useMemo(() => {
    const map = new Map<NewsDepartmentId, NewsPdfRecord[]>();
    for (const r of filteredPdfs) {
      const arr = map.get(r.departamento) || [];
      arr.push(r);
      map.set(r.departamento, arr);
    }
    return map;
  }, [filteredPdfs]);

  return (
    <div className="relative space-y-6">
      <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink3)]">{t.langLabel}</span>
        <select
          value={locale}
          onChange={(e) => setNewsLang(e.target.value as NewsLocale)}
          className="rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1 text-xs font-medium text-[var(--ink)]"
        >
          <option value="pt">{t.langPt}</option>
          <option value="en">{t.langEn}</option>
        </select>
      </div>

      <div className="pt-10 sm:pr-44 sm:pt-0">
        <h1 className="text-xl font-bold text-[var(--ink)]">{t.pageTitle}</h1>
        <p className="text-sm text-[var(--ink2)]">{t.pageSubtitle}</p>
        <div
          className="mt-3 rounded-lg border-2 border-[#22558c] bg-[#eff6ff] px-3 py-2 text-[11px] font-medium text-[#1e3a5f]"
          role="status"
        >
          {locale === 'pt' ? (
            <>
              <strong>Módulo NEWS atualizado</strong> · build <code className="rounded bg-white px-1">{NEWS_MODULE_BUILD}</code>
              {' · '}
              PDF por departamento + pré-visualização. Se não vir isto, faça{' '}
              <kbd className="rounded bg-white px-1">Cmd+Shift+R</kbd> ou <code>npm run dev:fresh</code>.
            </>
          ) : (
            <>
              <strong>NEWS module</strong> · build <code className="rounded bg-white px-1">{NEWS_MODULE_BUILD}</code>
              {' · '}
              PDF by department + preview. If you don&apos;t see this, hard-refresh or run{' '}
              <code>npm run dev:fresh</code>.
            </>
          )}
        </div>
      </div>

      {/* Linha 1: YouTube | Quadro de atualizações PDF */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="mp-live-badge rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {t.liveBadge}
            </span>
            <div className="flex items-center gap-1.5 text-red-600">
              <YoutubeIcon className="h-5 w-5" />
              <span className="text-sm font-semibold text-[var(--ink)]">{t.liveStream}</span>
            </div>
            <span className="ml-auto font-mono text-xs text-[var(--ink2)]" title={t.nyClock}>
              {t.nyClock}: {nyTime || '—'}
            </span>
          </div>
          <div className="relative aspect-video w-full flex-1 overflow-hidden rounded-lg bg-black ring-1 ring-[var(--border)]">
            {mounted ? (
              <iframe
                title="YouTube Live finance"
                src={YOUTUBE_EMBED}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-400">…</div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink3)]">{t.videoNote}</p>
          <a
            href={YOUTUBE_OPEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-fit items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] px-4 py-2 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--sand)]"
          >
            {t.openYoutube}
          </a>
        </section>

        <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <h2 className="text-base font-bold text-[var(--ink)]">{t.pdfBoardTitle}</h2>
          <p className="text-[11px] text-[var(--ink3)]">{t.pdfBoardSubtitle}</p>
          <div className="mt-3 max-h-[min(420px,50vh)] flex-1 space-y-2 overflow-y-auto pr-1">
            {!mounted && <p className="text-xs text-[var(--ink3)]">…</p>}
            {mounted && boardPdfs.length === 0 && (
              <p className="text-sm text-[var(--ink3)]">{t.pdfPreviewEmpty}</p>
            )}
            {mounted &&
              boardPdfs.map((r) => (
                <div
                  key={r.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    previewId === r.id
                      ? 'border-[var(--amber)] bg-[var(--amber-bg)]/50'
                      : 'border-[var(--border)] bg-[var(--cream)]/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--ink)]">{r.titulo_arquivo}</p>
                    <p className="text-[10px] text-[var(--ink2)]">
                      {departmentLabel(r.departamento, locale)} · {formatUploadDate(r.data_upload, locale)} ·{' '}
                      {r.usuario_upload}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPreview(r.id)}
                    className="shrink-0 rounded-lg bg-[#22558c] px-3 py-1.5 font-semibold text-white hover:bg-[#1a4470]"
                  >
                    {t.pdfView}
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>

      {/* Linha 2: Upload + histórico | Pré-visualização */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <h2 className="text-base font-bold text-[var(--ink)]">{t.pdfUploadTitle}</h2>

          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-[var(--ink3)]">
            {t.pdfDept}
            <select
              value={pdfDeptUpload}
              onChange={(e) => setPdfDeptUpload(e.target.value as NewsDepartmentId)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--cream)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              {NEWS_DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {locale === 'pt' ? d.pt : d.en}
                </option>
              ))}
            </select>
          </label>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragOver
                ? 'border-[var(--amber)] bg-[var(--amber-bg)]/40'
                : 'border-[var(--border)] bg-[var(--cream)]/50 hover:border-[var(--amber-bd)]'
            }`}
          >
            <input
              id="news-pdf-input"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onInputChange}
            />
            <span className="text-sm font-medium text-[var(--ink)]">{t.pdfDrop}</span>
            <span className="mt-1 text-[11px] text-[var(--ink3)]">{t.pdfOnly}</span>
            {pdfBusy && <span className="mt-2 text-xs text-[var(--blue)]">{t.pdfUploading}</span>}
            {pdfError && <span className="mt-2 text-xs text-[var(--red)]">{pdfError}</span>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-[var(--ink3)]">{t.pdfHistory}</span>
            <select
              value={pdfFilter}
              onChange={(e) => setPdfFilter(e.target.value as NewsDepartmentId | 'all')}
              className="rounded-lg border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-xs"
            >
              <option value="all">{t.pdfFilterAll}</option>
              {NEWS_DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {locale === 'pt' ? d.pt : d.en}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 max-h-[min(400px,45vh)] space-y-4 overflow-y-auto pr-1">
            {pdfFilter === 'all'
              ? NEWS_DEPARTMENTS.map((d) => {
                  const rows = groupedByDept.get(d.id) || [];
                  if (!rows.length) return null;
                  return (
                    <div key={d.id}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)]">
                        {locale === 'pt' ? d.pt : d.en}
                      </p>
                      <ul className="space-y-2">
                        {rows.map((r) => (
                          <li key={r.id}>
                            <PdfListRow
                              r={r}
                              locale={locale}
                              active={previewId === r.id}
                              onView={() => openPreview(r.id)}
                              t={t}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              : filteredPdfs.map((r) => (
                  <PdfListRow
                    key={r.id}
                    r={r}
                    locale={locale}
                    active={previewId === r.id}
                    onView={() => openPreview(r.id)}
                    t={t}
                  />
                ))}
            {filteredPdfs.length === 0 && mounted && (
              <p className="text-sm text-[var(--ink3)]">{t.pdfPreviewEmpty}</p>
            )}
          </div>
        </section>

        <section className="flex min-h-[480px] flex-col rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <h2 className="shrink-0 text-base font-bold text-[var(--ink)]">{t.pdfPreview}</h2>
          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--cream)]">
            {previewUrl ? (
              <iframe title="PDF preview" src={previewUrl} className="h-full min-h-[420px] w-full" />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center text-sm text-[var(--ink3)]">
                {t.pdfPreviewEmpty}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Time — legado */}
      <details className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm open:shadow-md">
        <summary className="cursor-pointer text-sm font-bold text-[var(--ink)]">
          {t.teamSectionTitle}{' '}
          <span className="text-[10px] font-normal text-[var(--ink3)]">({t.teamSectionHint})</span>
        </summary>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <span aria-hidden>📋</span>
              {t.teamTitle}
            </h3>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1a4470]"
            >
              {t.newUpdate}
            </button>
          </div>
        </div>
        <div className="mt-3 max-h-[min(360px,40vh)] space-y-3 overflow-y-auto pr-1">
          {!mounted && <p className="text-xs text-[var(--ink3)]">…</p>}
          {mounted && sorted.length === 0 && <p className="text-sm text-[var(--ink3)]">{t.emptyFeed}</p>}
          {mounted &&
            sorted.map((m) => (
              <TeamUpdateCard key={m.id} message={m} locale={locale} onReact={bumpReaction} onRead={bumpRead} />
            ))}
        </div>
      </details>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <form
            onSubmit={onSubmitNew}
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-[var(--ink)]">{t.modalTitle}</h3>
            <label className="mt-3 block text-xs font-medium text-[var(--ink2)]">
              {t.placeholderAuthor}
              <input
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
                maxLength={40}
              />
            </label>
            <label className="mt-2 block text-xs font-medium text-[var(--ink2)]">
              {t.categoryLabel}
              <select
                value={formCat}
                onChange={(e) => setFormCat(e.target.value as TeamCategory)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
              >
                <option value="urgent">{t.catUrgent}</option>
                <option value="general">{t.catGeneral}</option>
              </select>
            </label>
            <label className="mt-2 block text-xs font-medium text-[var(--ink2)]">
              {t.placeholderMessage}
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value.slice(0, 60))}
                rows={3}
                maxLength={60}
                className="mt-1 w-full resize-none rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1.5 text-sm"
              />
            </label>
            <p className="mt-1 text-[10px] text-[var(--ink3)]">{t.charsLeft(60 - formText.length)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink2)]"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="rounded bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                disabled={!formText.trim()}
              >
                {t.submit}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PdfListRow({
  r,
  locale,
  active,
  onView,
  t,
}: {
  r: NewsPdfRecord;
  locale: NewsLocale;
  active: boolean;
  onView: () => void;
  t: ReturnType<typeof newsStrings>;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        active ? 'border-[var(--amber)] bg-[var(--amber-bg)]/40' : 'border-[var(--border)] bg-[var(--cream)]/60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--ink)]">{r.titulo_arquivo}</p>
        <p className="text-[10px] text-[var(--ink3)]">
          {formatUploadDate(r.data_upload, locale)} · {(r.sizeBytes / 1024).toFixed(0)} KB
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="shrink-0 rounded-lg border border-[var(--border)] bg-white px-2 py-1 font-semibold text-[var(--blue)] hover:bg-[var(--sand)]"
      >
        {t.pdfView}
      </button>
    </div>
  );
}

function TeamUpdateCard({
  message: m,
  locale,
  onReact,
  onRead,
}: {
  message: TeamMessage;
  locale: NewsLocale;
  onReact: (id: string, key: keyof TeamMessage['reactions']) => void;
  onRead: (id: string) => void;
}) {
  const t = newsStrings(locale);
  const initial = m.author.trim().slice(0, 1).toUpperCase() || '?';
  const catLabel = m.category === 'urgent' ? t.catUrgent : t.catGeneral;
  const catClass =
    m.category === 'urgent'
      ? 'bg-red-100 text-red-800 ring-red-200'
      : 'bg-[var(--slate-bg)] text-[var(--slate)] ring-[var(--border)]';

  const onReadClick = () => {
    const k = `news-read-click-${m.id}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    onRead(m.id);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)]/80 p-3 shadow-sm">
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">{m.author}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${catClass}`}
            >
              {catLabel}
            </span>
            <span className="text-[10px] text-[var(--ink3)]">{formatRelativeTime(m.createdAt, locale)}</span>
          </div>
          <p className="mt-1 break-words text-sm leading-snug text-[var(--ink2)]">{m.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink3)]">
            <button
              type="button"
              onClick={onReadClick}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-[var(--paper)]"
              title={t.readsLabel}
            >
              👁 {m.reads} {t.readsShort}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-[var(--paper)]"
                aria-label="thumbs up"
                onClick={() => onReact(m.id, 'thumbsUp')}
              >
                👍 {m.reactions.thumbsUp}
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-[var(--paper)]"
                aria-label="heart"
                onClick={() => onReact(m.id, 'heart')}
              >
                ❤️ {m.reactions.heart}
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-[var(--paper)]"
                aria-label="wow"
                onClick={() => onReact(m.id, 'wow')}
              >
                😮 {m.reactions.wow}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
