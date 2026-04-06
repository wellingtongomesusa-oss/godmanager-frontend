export type NewsLocale = 'en' | 'pt';

export const NEWS_LOCALE_KEY = 'master-one-news-locale';

export function newsStrings(locale: NewsLocale) {
  const isPt = locale === 'pt';
  return {
    pageTitle: isPt ? 'Notícias' : 'News',
    pageSubtitle: isPt
      ? 'YouTube Live · quadro de procedimentos PDF por departamento · pré-visualização e histórico'
      : 'YouTube Live · PDF procedures by department · preview and history',
    langLabel: isPt ? 'Idioma' : 'Language',
    langEn: 'English',
    langPt: 'Português (BR)',

    liveBadge: isPt ? 'AO VIVO' : 'LIVE',
    liveStream: isPt ? 'Live / stream' : 'Live / stream',
    nyClock: isPt ? 'Nova York' : 'New York',
    videoNote: isPt
      ? 'Vídeo fixo · reprodução automática (mudo)'
      : 'Fixed video · autoplay (muted)',
    openYoutube: isPt ? 'Abrir no YouTube' : 'Open in YouTube',

    teamTitle: isPt ? 'Atualizações do Time' : 'Team Updates',
    newUpdate: isPt ? '+ Nova atualização' : '+ New update',
    readsLabel: isPt ? 'leituras' : 'reads',
    readsShort: isPt ? 'leit.' : 'reads',
    placeholderAuthor: isPt ? 'Seu nome' : 'Your name',
    placeholderMessage: isPt ? 'Mensagem (máx. 60)' : 'Message (max 60)',
    categoryLabel: isPt ? 'Categoria' : 'Category',
    catUrgent: isPt ? 'URGENTE' : 'URGENT',
    catGeneral: isPt ? 'GERAL' : 'GENERAL',
    submit: isPt ? 'Publicar' : 'Post',
    cancel: isPt ? 'Cancelar' : 'Cancel',
    modalTitle: isPt ? 'Nova atualização' : 'New update',
    charsLeft: (n: number) => (isPt ? `${n} caracteres restantes` : `${n} characters left`),
    emptyFeed: isPt ? 'Nenhuma atualização ainda.' : 'No updates yet.',

    pdfBoardTitle: isPt ? 'Quadro de atualizações (PDF)' : 'Updates board (PDF)',
    pdfBoardSubtitle: isPt ? 'Últimos comunicados e procedimentos' : 'Latest memos and procedures',
    pdfView: isPt ? 'Visualizar' : 'View',
    pdfDept: isPt ? 'Departamento' : 'Department',
    pdfUploadTitle: isPt ? 'Enviar PDF' : 'Upload PDF',
    pdfDrop: isPt ? 'Arraste o PDF aqui ou clique para selecionar' : 'Drag & drop PDF or click to select',
    pdfOnly: isPt ? 'Apenas PDF · máx. 20 MB' : 'PDF only · max 20 MB',
    pdfFilterAll: isPt ? 'Todos os departamentos' : 'All departments',
    pdfHistory: isPt ? 'Histórico por departamento' : 'History by department',
    pdfPreview: isPt ? 'Pré-visualização' : 'Preview',
    pdfPreviewEmpty: isPt ? 'Selecione um arquivo na lista ou envie um novo PDF.' : 'Pick a file from the list or upload a new PDF.',
    pdfUploading: isPt ? 'A processar…' : 'Processing…',
    pdfSuccess: isPt ? 'PDF guardado com sucesso.' : 'PDF saved successfully.',
    pdfError: isPt ? 'Erro ao guardar PDF.' : 'Failed to save PDF.',
    pdfFile: isPt ? 'Ficheiro' : 'File',
    pdfWhen: isPt ? 'Data / hora' : 'Date / time',
    pdfBy: isPt ? 'Utilizador' : 'User',
    pdfRemove: isPt ? 'Remover' : 'Remove',
    teamSectionTitle: isPt ? 'Mensagens rápidas do time' : 'Quick team messages',
    teamSectionHint: isPt ? 'Timeline curta (legado)' : 'Short timeline (legacy)',
    now: isPt ? 'agora' : 'just now',
    minAgo: (n: number) => (isPt ? `há ${n} min` : `${n} min ago`),
    hoursAgo: (n: number) => (isPt ? `há ${n} h` : `${n}h ago`),
    daysAgo: (n: number) => (isPt ? `há ${n} d` : `${n}d ago`),
  };
}

export function formatRelativeTime(iso: string, locale: NewsLocale): string {
  const t = newsStrings(locale);
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45_000) return t.now;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t.now;
  if (m < 60) return t.minAgo(m);
  const h = Math.floor(m / 60);
  if (h < 48) return t.hoursAgo(h);
  const d = Math.floor(h / 24);
  return t.daysAgo(d);
}
