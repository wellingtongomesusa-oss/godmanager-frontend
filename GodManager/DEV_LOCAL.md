# GodManager — Dev Local Setup

## Pré-requisitos

- Docker Desktop instalado
- Node 18+ (o projecto declara Node 20+ em `package.json`; usa 20+ em produção)

## Subir Postgres local

```bash
npm run db:local:up        # sobe container postgres
npm run db:local:migrate   # aplica migrations no DB local
```

## Rodar app contra DB local

```bash
npm run dev:local
# App em http://localhost:3101 usando Postgres local
```

Os scripts `db:local:*` e `dev:local` extraem **`DATABASE_URL_LOCAL`** de `.env.local` via **`dotenv-cli`** e só nessa execução definem **`DATABASE_URL`** assim (equivale ao `DATABASE_URL=$DATABASE_URL_LOCAL …` quando a variável já está carregada).

## Rodar app contra Railway PROD (CUIDADO)

```bash
npm run dev:prod-db
# Use só pra debug pontual — NUNCA rode migrate dev contra prod
```

Este comando usa o **`DATABASE_URL`** actual do `.env.local` tal como está (Next.js não precisa override).

## Reset DB local

```bash
npm run db:local:reset     # apaga tudo + reaplica migrations
npm run db:local:seed      # popula dados de teste (se houver seed.ts)
```

## Acessar psql local

```bash
npm run db:local:psql
```

## REGRAS

- NUNCA correr **`prisma migrate dev`** contra a base Railway prod
- Migrations em prod: **`prisma migrate deploy`** no `start` deploy (Railway) ou comando explícito com `DATABASE_URL` de prod — nunca usar `DATABASE_URL_LOCAL`
- Fluxo novo PR: migra primeiro em local (`migrate dev` com `DATABASE_URL` local), commit da migration SQL, Railway aplica **`migrate deploy`**
