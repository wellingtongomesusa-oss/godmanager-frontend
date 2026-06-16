-- menuAccess: allowed section/menu keys per user (Fase 1.A storage).
-- Semântica (enforcement na F1.B): array vazio = sem restrição (role-only).
-- super_admin nunca é restringido por menuAccess.
ALTER TABLE "users" ADD COLUMN "menuAccess" TEXT[] NOT NULL DEFAULT '{}';
