export type InvoiceStatus = 'rascunho' | 'enviada' | 'paga' | 'cancelada';

export type InvoiceRecord = {
  id: string;
  numero: string;
  cliente: string;
  valor: number;
  status: InvoiceStatus;
  vencimento: string;
  criadoEm: string;
};
