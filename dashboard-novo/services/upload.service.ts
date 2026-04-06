/**
 * Upload Service – dashboard-novo
 * Upload de CSV, PDF e imagens com validação. Mock: em produção integrar com backend/S3.
 */

export type UploadType = 'csv' | 'pdf' | 'image';

export interface UploadResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  type: UploadType;
  message: string;
  /** ID ou URL mock para referência. */
  id?: string;
}

const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB

const CSV_EXT = ['.csv'];
const PDF_EXT = ['.pdf'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function getExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i).toLowerCase() : '';
}

function validateExtension(fileName: string, allowed: string[]): boolean {
  return allowed.some((ext) => fileName.toLowerCase().endsWith(ext));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Valida e simula upload de CSV.
 */
export async function uploadCSV(file: File): Promise<UploadResult> {
  const ext = getExtension(file.name);
  if (!validateExtension(file.name, CSV_EXT)) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'csv', message: 'Invalid file type. Allowed: .csv' };
  }
  if (file.size > MAX_CSV_SIZE) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'csv', message: `File too large. Max ${MAX_CSV_SIZE / 1024 / 1024} MB.` };
  }
  await delay(400);
  return {
    success: true,
    fileName: file.name,
    fileSize: file.size,
    type: 'csv',
    message: 'CSV uploaded successfully.',
    id: `csv-${Date.now()}-${file.name}`,
  };
}

/**
 * Valida e simula upload de PDF.
 */
export async function uploadPDF(file: File): Promise<UploadResult> {
  if (!validateExtension(file.name, PDF_EXT)) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'pdf', message: 'Invalid file type. Allowed: .pdf' };
  }
  if (file.size > MAX_PDF_SIZE) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'pdf', message: `File too large. Max ${MAX_PDF_SIZE / 1024 / 1024} MB.` };
  }
  await delay(500);
  return {
    success: true,
    fileName: file.name,
    fileSize: file.size,
    type: 'pdf',
    message: 'PDF uploaded successfully.',
    id: `pdf-${Date.now()}-${file.name}`,
  };
}

/**
 * Valida e simula upload de imagem (JPEG/PNG).
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (!validateExtension(file.name, IMAGE_EXT)) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'image', message: 'Invalid file type. Allowed: .jpg, .jpeg, .png, .gif, .webp' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { success: false, fileName: file.name, fileSize: file.size, type: 'image', message: `File too large. Max ${MAX_IMAGE_SIZE / 1024 / 1024} MB.` };
  }
  await delay(350);
  return {
    success: true,
    fileName: file.name,
    fileSize: file.size,
    type: 'image',
    message: 'Image uploaded successfully.',
    id: `img-${Date.now()}-${file.name}`,
  };
}

/**
 * Valida extensão para tipo (usado no modal).
 */
export function validateFileType(file: File, type: 'csv' | 'pdf'): boolean {
  if (type === 'csv') return validateExtension(file.name, CSV_EXT);
  return validateExtension(file.name, PDF_EXT);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
