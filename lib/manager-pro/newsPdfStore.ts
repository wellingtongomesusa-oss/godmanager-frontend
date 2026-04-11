/**
 * Armazenamento local de PDFs do módulo NEWS (IndexedDB).
 * Estrutura alinhada ao spec: id, departamento, titulo_arquivo, data_upload, usuario_upload (+ blob).
 */
import type { NewsLocale } from './newsI18n';

export const NEWS_PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export type NewsDepartmentId =
  | 'financeiro'
  | 'operacoes'
  | 'juridico'
  | 'rh'
  | 'comercial'
  | 'ti'
  | 'compliance'
  | 'outros';

export const NEWS_DEPARTMENTS: { id: NewsDepartmentId; pt: string; en: string }[] = [
  { id: 'financeiro', pt: 'Financeiro', en: 'Finance' },
  { id: 'operacoes', pt: 'Operações', en: 'Operations' },
  { id: 'juridico', pt: 'Jurídico', en: 'Legal' },
  { id: 'rh', pt: 'RH', en: 'HR' },
  { id: 'comercial', pt: 'Comercial', en: 'Sales' },
  { id: 'ti', pt: 'TI', en: 'IT' },
  { id: 'compliance', pt: 'Compliance', en: 'Compliance' },
  { id: 'outros', pt: 'Outros', en: 'Other' },
];

export function departmentLabel(id: NewsDepartmentId, locale: NewsLocale): string {
  const row = NEWS_DEPARTMENTS.find((d) => d.id === id);
  if (!row) return id;
  return locale === 'pt' ? row.pt : row.en;
}

export type NewsPdfRecord = {
  id: string;
  departamento: NewsDepartmentId;
  titulo_arquivo: string;
  /** URL object interna: blob: — reconstruída no cliente a partir do id */
  url_pdf: `blob:client#${string}`;
  data_upload: string;
  usuario_upload: string;
  sizeBytes: number;
};

const DB_NAME = 'godmanager-news-pdf-db';
const DB_VERSION = 1;
const STORE_META = 'news_pdf_meta';
const STORE_BLOBS = 'news_pdf_blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

/** Metadados persistidos (sem url real; url_pdf é placeholder) */
type NewsPdfMetaRow = Omit<NewsPdfRecord, 'url_pdf'> & { url_pdf: string };

export async function listNewsPdfRecords(): Promise<NewsPdfRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as NewsPdfMetaRow[]) || [];
      const sorted = rows.sort(
        (a, b) => new Date(b.data_upload).getTime() - new Date(a.data_upload).getTime()
      );
      resolve(
        sorted.map((r) => ({
          ...r,
          url_pdf: `blob:client#${r.id}` as NewsPdfRecord['url_pdf'],
        }))
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getNewsPdfBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, 'readonly');
  const req = tx.objectStore(STORE_BLOBS).get(id);
  const data = await reqToPromise(req);
  if (!data) return null;
  return data as Blob;
}

export function validatePdfFile(file: File): { ok: true } | { ok: false; error: string } {
  const name = file.name.toLowerCase();
  const typeOk = file.type === 'application/pdf' || name.endsWith('.pdf');
  if (!typeOk) return { ok: false, error: 'Somente arquivos PDF são permitidos.' };
  if (file.size > NEWS_PDF_MAX_BYTES) {
    const mb = Math.floor(NEWS_PDF_MAX_BYTES / (1024 * 1024));
    return { ok: false, error: `Arquivo acima do limite (${mb} MB).` };
  }
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' };
  return { ok: true };
}

export async function saveNewsPdf(
  file: File,
  departamento: NewsDepartmentId,
  usuario_upload: string
): Promise<NewsPdfRecord> {
  const v = validatePdfFile(file);
  if (!v.ok) throw new Error(v.error);

  const id = crypto.randomUUID();
  const data_upload = new Date().toISOString();
  const titulo_arquivo = file.name;

  const db = await openDb();
  const meta: NewsPdfMetaRow = {
    id,
    departamento,
    titulo_arquivo,
    url_pdf: `blob:client#${id}`,
    data_upload,
    usuario_upload: usuario_upload || '—',
    sizeBytes: file.size,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.objectStore(STORE_META).put(meta);
    tx.objectStore(STORE_BLOBS).put(file, id);
  });

  return {
    ...meta,
    url_pdf: `blob:client#${id}` as NewsPdfRecord['url_pdf'],
  };
}

export async function deleteNewsPdf(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.objectStore(STORE_META).delete(id);
    tx.objectStore(STORE_BLOBS).delete(id);
  });
}
