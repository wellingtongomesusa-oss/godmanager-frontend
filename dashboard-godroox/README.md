# Dashboard Godroox

App **standalone** do dashboard administrativo Godroox. Roda sozinho e pode ser vinculado ao site principal (godroox.com) depois.

## O que é

- Next.js 14 (App Router)
- Dashboard com métricas, transações, dupla alçada e filtros
- Login próprio (e-mail) para uso isolado
- Mesmo tema visual Godroox (cores, tipografia)

## Como rodar

```bash
cd dashboard-godroox
npm install
npm run dev
```

Abre em **http://localhost:3001**. Na raiz (`/`) redireciona para `/login` ou `/dashboard` conforme o `localStorage`. Em `/login`, informe um e-mail e clique em **Entrar no Dashboard**.

## Como vincular ao site principal

Você pode integrar este app ao site Godroox de três maneiras:

### 1. Subdomínio (recomendado)

- **Site principal:** `godroox.com` (projeto atual em `godroox/`)
- **Dashboard:** `dashboard.godroox.com` (este app)

**Passos:**

1. Publicar este app em um host (Vercel, AWS, etc.) com domínio `dashboard.godroox.com`.
2. No site principal, colocar um link “Admin” ou “Dashboard” que aponta para `https://dashboard.godroox.com`.
3. **Auth:**  
   - Hoje o dashboard usa login próprio (e-mail + `localStorage`).  
   - Para usar o login do site principal:
     - No site principal: após login, redirecionar para  
       `https://dashboard.godroox.com?token=...` (ou enviar o token por POST/cookie).  
     - No dashboard: ler o `token` (ou cookie), chamar a API do site para validar e, se válido, considerar o usuário logado e redirecionar para `/dashboard`.

### 2. Mesmo domínio, path (`/admin`)

- **Site:** `godroox.com`  
- **Dashboard:** `godroox.com/admin` ou `godroox.com/dashboard`

**Passos:**

1. No projeto do site principal (`godroox/`), configurar rewrites/proxy no `next.config.js` para que `/admin/*` ou `/dashboard/*` sejam servidos por este app (por exemplo, apontando para a URL onde o dashboard está hospedado), **ou**
2. Copiar as rotas e componentes deste app para dentro do app do site principal em algo como `app/admin/` ou `app/(app)/admin/` (o que você já tem em parte hoje).

A opção “copiar para o mesmo repo” é a que já existe em `godroox/app/(app)/admin/`. Este projeto `dashboard-godroox` é a “versão app separado” dessa mesma UI.

### 3. Link simples (sem SSO)

- No site principal: um link “Área admin” → `https://dashboard.godroox.com` (ou o URL onde este app estiver).
- O usuário abre o dashboard em outra aba e faz login só no dashboard (e-mail, como hoje).

Não usa o login do site; apenas o link junta os dois.

---

## Resumo de vínculo com o site principal

| Onde o dashboard roda | Como “vincular” ao site |
|------------------------|-------------------------|
| **Subdomínio** `dashboard.godroox.com` | Link “Admin” no site → `https://dashboard.godroox.com`. Auth: token/cookie na URL ou via API após login no site. |
| **Mesmo domínio** `godroox.com/admin` | Rewrite/proxy no Next do site para este app, ou migrar esta app para dentro do repo do site em `app/admin/`. |
| **Só link** | Botão “Dashboard” no site que abre este app (em outra aba). Login continua só no dashboard. |

## Estrutura do projeto

```
dashboard-godroox/
├── app/
│   ├── page.tsx          # Redireciona para /login ou /dashboard
│   ├── login/page.tsx    # Login por e-mail (standalone)
│   └── dashboard/
│       ├── layout.tsx    # Sidebar + header + checagem de auth
│       └── page.tsx      # Métricas + tabela de transações
├── components/
│   ├── ui/               # Button, Card, Logo
│   └── admin/            # AdminSidebar, AdminHeader, MetricCards, TransactionsTable
├── services/admin/       # Métricas, transações, dupla alçada (mocks)
└── lib/utils.ts
```

## Dados e backend

Hoje tudo usa **mocks** em `services/admin/admin-dashboard.service.ts`. Para produção:

1. Trocar as chamadas por requests à API do site principal (ou a um backend único).
2. Usar o mesmo token/sessão do login do site para autenticar as rotas do dashboard.

## Porta

O script `dev` usa a porta **3001** para não conflitar com o site principal em 3000:

```bash
npm run dev   # → http://localhost:3001
```

Se quiser outra porta, altere em `package.json` em `"dev": "next dev -p 3001"`.
