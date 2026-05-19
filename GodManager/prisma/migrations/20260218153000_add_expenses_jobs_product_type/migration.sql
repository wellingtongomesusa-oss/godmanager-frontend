-- Enum ClientProductType: novo valor EXPENSES_JOBS (sem alterar dados existentes).
ALTER TYPE "ClientProductType" ADD VALUE IF NOT EXISTS 'EXPENSES_JOBS';
