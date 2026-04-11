# godmanager-frontend (monorepo)

Este repositório contém o workspace **GodManager** em **`./GodManager/`** (Next.js — GodManager.One, App Router) e outros projetos na raiz.

## GodManager (Next.js)

```bash
cd GodManager
rm -rf .next
npm install
npm run dev
```

Abre `http://localhost:3101` (ou a porta que o terminal indicar — por defeito **3101**).

Na **raiz** do repositório também podes usar:

```bash
npm install
npm run dev
```

(é equivalente a `npm run dev` dentro de `GodManager`.)

### Confirmação rápida

No browser: `http://localhost:PORTA/godmanager-ui.txt`  
A primeira linha deve ser: `godmanager-ui-v2-godmanager-one`

Se vês **MANAGER PRO** no menu, o `next dev` **não** está a correr desta pasta `GodManager` (ou a cache `.next` está velha).

### Se vir 404 em `localhost:3010`

Outro programa já pode usar a porta 3010. Este projeto usa **3101** por defeito. Para forçar 3010: na pasta `GodManager`, `npm run dev:3010` (fecha o que estiver a usar 3010 antes).

### Ecrã branco com `missing required error components, refreshing...`

1. **Pare** todos os `next dev`.
2. Em **`GodManager`**: `rm -rf .next` e `npm run dev`.
3. Abra **`http://localhost:3101`**.

### Página branca em `localhost:3101`

Muitas vezes o servidor responde **500** com cache `.next` partida. Pare o `next dev`, em `GodManager` execute `npm run dev:fresh` (ou apague `.next`) e volte a subir o dev.

### `Error: Cannot find module './844.js'` (ou outro `.js`)

A pasta **`.next`** ficou inconsistente. Pare o servidor, em `GodManager`: `npm run dev:fresh` ou `rm -rf node_modules && npm install && npm run dev:fresh`.

### GodManager / suite (login, módulos)

- **Login (exemplo):** `http://localhost:3101/manager-pro/login` (ajuste conforme a sua rota atual).
- Confirmação de build: `/godmanager-ui.txt` — primeira linha `godmanager-ui-v2-godmanager-one`.

## Site Flask (`GodManager/website/`)

```bash
cd GodManager/website
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Para o hub CRM na porta **5001**, na pasta `GodManager`: `npm run dev:crm` ou `npm run dev:full` (Next + CRM). Ver `GodManager/website/README.md` se existir.

## Scripts na pasta `GodManager`

| Comando | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento (porta **3101**) |
| `npm run dev:crm` | CRM Flask em **127.0.0.1:5001** |
| `npm run dev:full` | Next (3101) + CRM (5001) em paralelo |
| `npm run dev:fresh` / `dev:clean` | Limpa `.next` + cache e inicia o dev |
| `npm run build` / `start` / `lint` | Build, produção, ESLint |

## Estrutura (GodManager)

- `GodManager/app/` — Next.js (App Router)
- `GodManager/website/` — Flask, templates, estáticos
- `GodManager/public/` — estáticos do Next (`godmanager-ui.txt`, etc.)

## Backup em ZIP

Na pasta pai pode existir um backup zip do código. Exemplo de comando (executar onde fizer sentido no teu ambiente):

```bash
zip -r "GodManager-backup-$(date +%Y-%m-%d).zip" GodManager \
  -x "GodManager/node_modules/*" -x "GodManager/.next/*"
```

## Master-Finance (projeto separado)

Pasta **`./Master-Finance/`**:

```bash
cd Master-Finance
npm install
npm run dev
```

Por defeito: **http://localhost:3000**
