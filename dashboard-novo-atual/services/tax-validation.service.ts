/**
 * Tax Validation Service – dashboard-novo
 * Validação de EIN, SSN e ITIN (mock). Em produção: integrar com IRS TIN Matching
 * e APIs oficiais (IRS e-Services, MeF).
 */

export type TaxIdType = 'EIN' | 'SSN' | 'ITIN';

export interface TaxValidationRequest {
  idType: TaxIdType;
  value: string;
  name?: string;
  businessName?: string;
}

export interface TaxValidationResult {
  valid: boolean;
  idType: TaxIdType;
  formatted?: string;
  message: string;
  /** IRS TIN Matching response code (mock). */
  irsCode?: string;
}

const EIN_REGEX = /^\d{2}-?\d{7}$/;
const SSN_REGEX = /^\d{3}-?\d{2}-?\d{4}$/;
const ITIN_REGEX = /^9\d{2}-?\d{2}-?\d{4}$/;

function normalize(id: string): string {
  return id.replace(/\D/g, '');
}

function formatEIN(value: string): string {
  const n = normalize(value);
  return n.length === 9 ? `${n.slice(0, 2)}-${n.slice(2)}` : value;
}

function formatSSN(value: string): string {
  const n = normalize(value);
  return n.length === 9 ? `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}` : value;
}

function formatITIN(value: string): string {
  const n = normalize(value);
  return n.length === 9 ? `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}` : value;
}

/**
 * Valida formato e (mock) consistência de EIN.
 * Ref: IRS EIN format 12-3456789.
 */
export function validateEIN(value: string): TaxValidationResult {
  const n = normalize(value);
  if (n.length !== 9) {
    return { valid: false, idType: 'EIN', message: 'EIN must be 9 digits.', irsCode: 'INVALID_LENGTH' };
  }
  if (!EIN_REGEX.test(n.slice(0, 2) + n.slice(2))) {
    return { valid: false, idType: 'EIN', message: 'Invalid EIN format.', irsCode: 'INVALID_FORMAT' };
  }
  return {
    valid: true,
    idType: 'EIN',
    formatted: formatEIN(value),
    message: 'EIN format is valid. For official verification use IRS TIN Matching.',
    irsCode: '0',
  };
}

/**
 * Valida formato de SSN (não valida com IRS em mock).
 * Ref: IRS SSN format 123-45-6789.
 */
export function validateSSN(value: string): TaxValidationResult {
  const n = normalize(value);
  if (n.length !== 9) {
    return { valid: false, idType: 'SSN', message: 'SSN must be 9 digits.', irsCode: 'INVALID_LENGTH' };
  }
  const area = n.slice(0, 3);
  if (area === '000' || area === '666' || area >= '900') {
    return { valid: false, idType: 'SSN', message: 'Invalid SSN area number.', irsCode: 'INVALID_AREA' };
  }
  return {
    valid: true,
    idType: 'SSN',
    formatted: formatSSN(value),
    message: 'SSN format is valid. For official verification use IRS TIN Matching.',
    irsCode: '0',
  };
}

/**
 * Valida formato de ITIN (9 dígitos, começa com 9).
 * Ref: IRS ITIN format 9XX-XX-XXXX.
 */
export function validateITIN(value: string): TaxValidationResult {
  const n = normalize(value);
  if (n.length !== 9) {
    return { valid: false, idType: 'ITIN', message: 'ITIN must be 9 digits.', irsCode: 'INVALID_LENGTH' };
  }
  if (n[0] !== '9') {
    return { valid: false, idType: 'ITIN', message: 'ITIN must start with 9.', irsCode: 'INVALID_PREFIX' };
  }
  return {
    valid: true,
    idType: 'ITIN',
    formatted: formatITIN(value),
    message: 'ITIN format is valid. For official verification use IRS TIN Matching.',
    irsCode: '0',
  };
}

/**
 * Valida identificador fiscal conforme tipo.
 */
export function validateTaxId(request: TaxValidationRequest): TaxValidationResult {
  const { idType, value } = request;
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return { valid: false, idType, message: 'Identifier is required.' };
  }
  switch (idType) {
    case 'EIN':
      return validateEIN(trimmed);
    case 'SSN':
      return validateSSN(trimmed);
    case 'ITIN':
      return validateITIN(trimmed);
    default:
      return { valid: false, idType, message: 'Unknown identifier type.' };
  }
}
