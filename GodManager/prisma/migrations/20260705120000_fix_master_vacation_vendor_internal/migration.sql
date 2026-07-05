-- Correção: "Master Vacation Homes - Vendor" é vendor (não equipe interna).
-- A migration 20260705100000_pmvendor_is_internal marcou por ILIKE 'Master Vacation%',
-- incluindo esse indevidamente. Aqui desmarcamos para que os jobs dele contem como Vendor,
-- não Manutenção. LLC e "- Manutenção" permanecem internos (a fila do Jair).
UPDATE "pm_vendors" SET "isInternal" = false WHERE "companyName" = 'Master Vacation Homes - Vendor';
