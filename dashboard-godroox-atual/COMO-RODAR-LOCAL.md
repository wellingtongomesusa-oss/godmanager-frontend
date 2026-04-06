# Como ver o dashboard no localhost

Siga **uma** das opções abaixo.

---

## Opção 1 — Usar o dashboard dentro do Godroox (recomendado)

O dashboard já está no projeto **godroox**. Use a porta **3000**.

### No terminal:

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
npm run dev
```

### No navegador:

1. Abra **http://localhost:3000**
2. Clique em **Sign In** (ou vá em http://localhost:3000/login)
3. Faça login:
   - **E-mail:** `admin@godroox.com`
   - **Senha:** qualquer uma (ex.: `123`)
4. Você será redirecionado para **http://localhost:3000/admin/dashboard**

Pronto. O dashboard Godroox abre nessa URL.

---

## Opção 2 — Usar o app separado "dashboard-godroox"

O app **dashboard-godroox** roda sozinho na porta **3001**. Para ver os **usuários cadastrados no frontend**, o projeto **godroox** precisa estar rodando na porta **3000** e o dashboard precisa de um `.env.local` apontando para ele.

### No terminal (na primeira vez):

```bash
cd /Users/wellingtongomes/cursor-projects/dashboard-godroox
npm install
cp .env.example .env.local   # depois ajuste MASTER_USER, MASTER_PASSWORD, etc.
```

No `.env.local`, confira:

- `NEXT_PUBLIC_GODROOX_API_URL=http://localhost:3000` — URL do frontend Godroox
- `DASHBOARD_API_SECRET=SenhaMaster123!` — deve ser igual a `DASHBOARD_API_SECRET` no `.env.local` do **godroox**

Espere terminar o install. Depois, **rode o godroox na porta 3000** (em outro terminal) e então o dashboard:

```bash
# Terminal 1 – frontend (godroox)
cd /Users/wellingtongomes/cursor-projects/godroox
npm run dev

# Terminal 2 – dashboard
cd /Users/wellingtongomes/cursor-projects/dashboard-godroox
npm run dev
```

### No navegador:

1. Abra **http://localhost:3001**
2. Você verá a tela de **login do dashboard**
3. Digite qualquer e-mail (ex.: `admin@godroox.com`)
4. Clique em **Entrar no Dashboard**
5. O dashboard abre em **http://localhost:3001/dashboard**

---

## Se ainda não funcionar

- **“Cannot find module” ou “Module not found”**  
  → Você está no **dashboard-godroox** e ainda não rodou `npm install`. Rode na pasta do projeto:
  ```bash
  cd /Users/wellingtongomes/cursor-projects/dashboard-godroox
  npm install
  ```

- **“Port 3000 is already in use”**  
  → Outro processo está usando a porta. Feche o outro processo ou use outra porta, por exemplo:
  ```bash
  npx next dev -p 3002
  ```

- **Página em branco ou “This site can’t be reached”**  
  → Confirme a URL: Godroox é **http://localhost:3000**, dashboard-godroox é **http://localhost:3001**.  
  → Confirme que o terminal mostra algo como “Ready” ou “compiled successfully” antes de abrir o navegador.

- **Redirect para login ao abrir /admin/dashboard**  
  → No Godroox, é preciso estar logado como admin. Use **admin@godroox.com** no login.

- **“Não foi possível conectar ao frontend”** (na seção Usuários cadastrados)  
  → O **godroox** precisa estar rodando na porta **3000** (`cd godroox && npm run dev`).  
  → No **dashboard-godroox**, o `.env.local` deve ter `NEXT_PUBLIC_GODROOX_API_URL=http://localhost:3000` e `DASHBOARD_API_SECRET` igual ao do godroox (ex.: `SenhaMaster123!`).  
  → Veja **godroox/docs/FRONTEND-E-DASHBOARD.md** para o passo a passo completo.
