# GodManager

Projeto **GodManager** (**GodManager.One** no dashboard) com **Next.js** (App Router) na raiz e o site **Flask** extraído de `website.zip` na pasta `website/`.

### Backup em ZIP

Na pasta pai **`cursor-projects`** pode existir um ficheiro `GodManager-backup-AAAA-MM-DD.zip` (código-fonte + `public` + `website`, **sem** `node_modules` nem `.next`). Para gerar de novo:

```bash
cd cursor-projects
zip -r "GodManager-backup-$(date +%Y-%m-%d).zip" GodManager \
  -x "GodManager/node_modules/*" -x "GodManager/.next/*"
```

Depois do restore: `cd GodManager && npm install && npm run dev`.

## Next.js (frontend novo)

```bash
cd GodManager
npm install
npm run dev
```

Abra [http://localhost:3101](http://localhost:3101).

> **Se vir 404 em `localhost:3010`:** outro programa já usa a porta 3010. Este projeto usa **3101** por defeito (`npm run dev`). Para forçar 3010: `npm run dev:3010` (feche o que estiver a usar 3010 antes).

### Ecrã branco com `missing required error components, refreshing...`

1. **Pare** todos os `next dev` (terminais onde corre o servidor).
2. Na pasta **`GodManager`** execute:
   ```bash
   rm -rf .next
   npm run dev
   ```
3. Abra **`http://localhost:3101`** — não use 3010 a menos que tenha corrido `npm run dev:3010` e a porta esteja livre.

Isto repõe a cache de build; o projeto inclui `app/error.tsx`, `app/global-error.tsx` e `app/not-found.tsx` para o Next tratar erros sem cair nesse fallback.

### Página **branca** em `localhost:3101`

Muitas vezes o servidor está a responder **500** com cache `.next` partida. O Next esconde o `body` até carregar (`display:none`) e, com erro, **nunca mostra nada** → ecrã branco.

1. Pare o `next dev` (**Ctrl+C**).  
2. `npm run dev:fresh` (ou apague manualmente a pasta `.next`).  
3. Volte a correr `npm run dev` e recarregue a página.

Confirme no terminal se há erros vermelhos ao abrir `/`.

### `Error: Cannot find module './844.js'` (ou outro número `.js`)

A pasta **`.next`** ficou inconsistente (servidor a correr enquanto ficheiros mudaram, ou build interrompido).

1. **Pare o servidor** (`Ctrl+C` no terminal do `next dev`).
2. Execute **só um** destes (na pasta `GodManager`):

   ```bash
   npm run dev:fresh
   ```

   (equivale a apagar `.next` e `node_modules/.cache` e subir o dev na porta **3101**.)

3. Se ainda falhar: `rm -rf node_modules && npm install && npm run dev:fresh`

**Windows (PowerShell):** em vez de `rm -rf`, pode usar `Remove-Item -Recurse -Force .next, node_modules/.cache` e depois `npm run dev`.

### GodManager / manager-pro (PDF `Manager_PRO_Prompts_2026-03-21`)

Suite imobiliária corporativa com **login obrigatório** e os **16 módulos** do documento (RACI, Rent Roll, Housekeeper, Cars, Reservations, Payouts, Properties, 1099/IRS, Renovations, DP/DP+, Home cards, design system, etc.).

- **Login:** [http://localhost:3101/manager-pro/login](http://localhost:3101/manager-pro/login)  
- **Credenciais demo:** `admin@managerpro.local` / `ManagerPRO2026!`  
- Sessão em `localStorage` · **Sair** limpa a sessão.

Confirmação de build: no browser abra `/godmanager-ui.txt` — a primeira linha deve ser `godmanager-ui-v2-godmanager-one`.

O arquivo PDF original permanece na sua pasta **Downloads**; não é apagado pelo projeto.

## Site Flask (`website/` — conteúdo do zip)

Aplicação Python (Flask + SQLAlchemy + templates Jinja2).

```bash
cd website
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env         # ajuste variáveis e banco (PostgreSQL)
python app.py
```

Abra [http://localhost:5000](http://localhost:5000).

Detalhes de Docker, nginx e banco: veja `website/README.md`.

## Scripts Next.js

| Comando         | Descrição                    |
|----------------|------------------------------|
| `npm run dev`  | Desenvolvimento (porta **3101** no `GodManager`; **3080** na pasta `GodManager 2`) |
| `npm run dev:fresh` / `dev:clean` | Apaga `.next` + cache e inicia o dev (use após erro `Cannot find module './XXX.js'`) |
| `npm run dev:3010` | Desenvolvimento na porta 3010 |
| `npm run build`| Build de produção            |
| `npm run start`| Produção (porta **3101**)    |
| `npm run lint` | ESLint                       |

## Estrutura

- `app/` — Next.js (App Router)
- `website/` — app Flask, `templates/`, `static/`, Docker, etc.
- `public/` — estáticos do Next.js (`godmanager-ui.txt` — marcador de versão UI)

## GodManager Trust (pasta `GodManager 2`)

- **Porta dev:** `3080` (`npm run dev` nesta pasta).
- **Landing:** `/` — hero champagne/coal + painel KPI (`useTrustKPIs`).
- **Faturas:** `/manager-pro/invoices` — estilo landing; permissões em `localStorage` (demo).
- **Integrações:** `/manager-pro/integrations/*` — QuickBooks, Folio, Ramp, Rent Engine, Boom (dados mock + rotas OAuth onde aplicável).
- **Variáveis:** copie `.env.example` para `.env.local` e preencha chaves (nunca commitar segredos).
- **Banner de prazo:** `NEXT_PUBLIC_TRUST_PROPOSAL_URL` — visível para admin/primary até 30/03/2026.
