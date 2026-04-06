/**
 * OCR – leitura automática de bills (Google Vision / Tesseract simulados).
 * Em produção: enviar imagem para Google Cloud Vision ou Tesseract.js e mapear campos.
 */

export interface OcrBillRequest {
  imageDataUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface OcrBillResult {
  success: boolean;
  vendor?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  description?: string;
  rawText?: string;
  confidence?: number;
  errorCode?: string;
  message?: string;
}

/**
 * Simula OCR sobre imagem de fatura.
 * Em produção: POST para Google Vision API ou processar com Tesseract.js no client.
 */
export async function processBillImage(request: OcrBillRequest): Promise<OcrBillResult> {
  await delay(800);
  const hasImage = !!(request.imageDataUrl ?? request.imageBase64);
  if (!hasImage) {
    return {
      success: false,
      errorCode: 'NO_IMAGE',
      message: 'No image provided',
    };
  }
  return {
    success: true,
    vendor: 'Sample Vendor Inc',
    amount: 1250.5,
    currency: 'USD',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: 'Invoice from OCR extraction',
    rawText: 'Sample Vendor Inc\nAmount: $1,250.50\nDue: ...',
    confidence: 0.92,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
