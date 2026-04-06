# Frontend e Dashboard em localhosts diferentes – visões exclusivas e independentes

O **frontend** (site Godroox) e o **dashboard** (área administrativa) rodam em **portas diferentes**, com visões independentes. Tudo que for cadastrado no frontend aparece de forma organizada no dashboard. O acesso ao dashboard é **apenas com usuário master e senha master**.

---

## Portas e projetos

| Aplicação | Pasta | Porta | URL |
|-----------|--------|-------|-----|
| **Frontend (site)** | `godroox/` | 3000 | http://localhost:3000 |
| **Dashboard** | `dashboard-godroox/` | 3001 | http://localhost:3001 |

Cada um é um projeto Next.js separado. Você pode rodar os dois ao mesmo tempo.

---

## Como rodar os dois localhosts

### 1. Frontend (site Godroox)

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
npm install   # só na primeira vez
npm run dev
```

Acesse **http://localhost:3000** – páginas públicas, login, cadastro, serviços.

### 2. Dashboard (área admin)

```bash
cd /Users/wellingtongomes/cursor-projects/dashboard-godroox
npm install   # só na primeira vez
cp .env.example .env   # criar .env e ajustar MASTER_USER / MASTER_PASSWORD
npm run dev
```

Acesse **http://localhost:3001** – só entra após login **master** (usuário + senha master).

---

## Acesso ao dashboard: usuário e senha master

O dashboard **não** usa o login do site. O acesso é só com:

- **Usuário master** e **Senha master**

Esses valores vêm das variáveis de ambiente do **dashboard**:

- `MASTER_USER` – usuário master (ex.: `master`)
- `MASTER_PASSWORD` – senha master (ex.: `SenhaMaster123!`)

**No dashboard**, crie um arquivo `.env` (a partir do `.env.example`):

```env
MASTER_USER=master
MASTER_PASSWORD=SenhaMaster123!
NEXT_PUBLIC_GODROOX_API_URL=http://localhost:3000
DASHBOARD_API_SECRET=SenhaMaster123!
```

O login do dashboard chama a API interna `/api/auth/master`, que compara usuário e senha com `MASTER_USER` e `MASTER_PASSWORD`. Essas variáveis ficam só no servidor; o frontend do dashboard não as enxerga.

---

## Cadastros do frontend no dashboard

O dashboard exibe os **usuários cadastrados no frontend** na seção **“Usuários cadastrados (Frontend)”**.

### Fluxo

1. No **frontend** (localhost:3000), o usuário se cadastra (signup, formulários, etc.).
2. O frontend grava no banco (Prisma) quando houver `DATABASE_URL` configurado.
3. O **dashboard** (localhost:3001) chama a própria API `/api/cadastros`.
4. Essa API do dashboard faz um **GET** para o frontend:  
   `http://localhost:3000/api/v1/admin/cadastros`  
   enviando o header `X-Dashboard-Secret` com o valor de `DASHBOARD_API_SECRET`.
5. O frontend só responde se `X-Dashboard-Secret` for igual a `DASHBOARD_API_SECRET` (ou `MASTER_PASSWORD`) definido no **.env do frontend**.
6. O dashboard recebe a lista de usuários e mostra na tabela “Usuários cadastrados”.

### Configuração no frontend (Godroox)

No `.env` do **godroox**:

```env
# Chave que o dashboard usa para acessar a API de cadastros
# Deve ser igual a DASHBOARD_API_SECRET no .env do dashboard
DASHBOARD_API_SECRET=SenhaMaster123!
```

Para o dashboard em outra origem (por exemplo outro localhost), o frontend já envia CORS com `Access-Control-Allow-Origin` (via `ALLOWED_ORIGINS` ou `*`). O header `X-Dashboard-Secret` está permitido no `next.config.js`.

### Quando não há banco no frontend

Se o Godroox estiver sem `DATABASE_URL`, a rota `/api/v1/admin/cadastros` devolve uma **lista mock** de usuários. Assim o dashboard continua mostrando uma tabela organizada; em produção basta configurar o banco para usar os cadastros reais.

---

## Resumo

| O que | Onde | Como |
|-------|------|-----|
| **Frontend** | godroox, porta 3000 | Site público + cadastros |
| **Dashboard** | dashboard-godroox, porta 3001 | Acesso só com usuário + senha master |
| **Login dashboard** | dashboard-godroox | `MASTER_USER` + `MASTER_PASSWORD` no .env do dashboard |
| **Cadastros no dashboard** | dashboard-godroox | Vindos do frontend via `GET /api/v1/admin/cadastros` |
| **Proteção da API de cadastros** | godroox | Header `X-Dashboard-Secret` = `DASHBOARD_API_SECRET` no .env do godroox |

Assim você tem **dois localhosts**, **visões independentes** (site vs dashboard) e **tudo que for cadastrado no frontend** aparecendo de forma organizada no dashboard, com acesso ao dashboard **restrito ao usuário e senha master**.
