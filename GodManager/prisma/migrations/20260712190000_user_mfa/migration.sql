-- MFA (TOTP) opt-in por usuário. Não afeta contas existentes (default false).
ALTER TABLE "users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaBackupCodes" TEXT;
