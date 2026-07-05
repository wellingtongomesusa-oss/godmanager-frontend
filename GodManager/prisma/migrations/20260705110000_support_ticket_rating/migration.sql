-- Avaliação (1-5 estrelas) do chamado pelo requester ao fechar/resolver.
ALTER TABLE "support_tickets" ADD COLUMN "rating" INTEGER;
ALTER TABLE "support_tickets" ADD COLUMN "ratedAt" TIMESTAMP(3);
