import type { PmPackage } from '@prisma/client';

export const PM_PACKAGE_MULT: Record<PmPackage, number> = {
  PACOTE_1: 1.15,
  PACOTE_2: 1.18,
  PACOTE_3: 1.25,
  PACOTE_4: 1.0,
};

export const PM_PACKAGE_LABEL: Record<PmPackage, string> = {
  PACOTE_1: 'Pacote 1 (15%)',
  PACOTE_2: 'Pacote 2 (18%)',
  PACOTE_3: 'Pacote 3 (25%)',
  PACOTE_4: 'Pacote 4 (0%)',
};

export const PM_PACKAGE_MARKUP_PCT: Record<PmPackage, number> = {
  PACOTE_1: 15,
  PACOTE_2: 18,
  PACOTE_3: 25,
  PACOTE_4: 0,
};

export function ownerChargedAmount(vendorCost: number, pkg: PmPackage): number {
  const m = PM_PACKAGE_MULT[pkg];
  return Math.round(vendorCost * m * 100) / 100;
}

export function parsePmPackage(s: string | undefined | null): PmPackage | null {
  if (s === 'PACOTE_1' || s === 'PACOTE_2' || s === 'PACOTE_3' || s === 'PACOTE_4') return s;
  return null;
}
