/**
 * Dados padrão da empresa (Godroox) – preenchimento automático em invoices.
 * Editável pelo usuário no formulário.
 */

export interface CompanyData {
  name: string;
  legalName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  taxId?: string;
  website?: string;
}

export const defaultCompany: CompanyData = {
  name: 'Godroox',
  legalName: 'Godroox Inc.',
  address: 'Av. Paulista, 1000',
  city: 'São Paulo',
  state: 'SP',
  zip: '01310-100',
  country: 'Brasil',
  email: 'contato@godroox.com',
  phone: '+55 11 3000-0000',
  taxId: '00.000.000/0001-00',
  website: 'https://godroox.com',
};
