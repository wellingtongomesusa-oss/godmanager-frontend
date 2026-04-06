# Como visualizar o site e o dashboard Godroox no seu computador

Site e dashboard rodam no **mesmo projeto** (Godroox) e na **mesma porta** (3000). Siga os passos **na ordem**.

### Resumo em 3 linhas

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
npm install    # só na primeira vez
npm run dev    # deixa rodando; no navegador abra http://localhost:3000
```

- **Site:** http://localhost:3000  
- **Dashboard:** http://localhost:3000/login → e-mail `admin@godroox.com` → redireciona para o dashboard

---

## Passo 1 — Abrir o terminal

- No **Cursor**: menu **Terminal** → **New Terminal** (ou `` Ctrl+` `` / `` Cmd+` ``).
- Ou use o **Terminal.app** / **iTerm** no macOS.

Use sempre o **mesmo terminal** para os próximos passos.

---

## Passo 2 — Entrar na pasta do projeto Godroox

No terminal, digite **exatamente** (ou cole):

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
```

Confirme que o prompt mostra algo como `.../godroox` antes de continuar.

---

## Passo 3 — Instalar dependências (só na primeira vez)

Se você **nunca** rodou o projeto nessa máquina, execute:

```bash
npm install
```

Espere terminar (pode demorar 1–2 minutos). Só então vá para o Passo 4.

Se já instalou antes, pule direto para o Passo 4.

---

## Passo 4 — Subir o servidor

No mesmo terminal, dentro da pasta `godroox`, rode:

```bash
npm run dev
```

Você deve ver algo como:

```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - Ready in Xs
```

**Não feche esse terminal** e não pare o comando (Ctrl+C para parar quando quiser).

---

## Passo 5 — Abrir o navegador

Abra o **Chrome**, **Safari** ou **Edge** e acesse:

```
http://localhost:3000
```

Se aparecer a página inicial da Godroox (carrossel, serviços, etc.), o **site** está ok.

---

## Passo 6 — Ver o site (página inicial e outras)

Com o servidor rodando e o navegador em `http://localhost:3000`:

| O que você quer ver | URL no navegador |
|--------------------|------------------|
| Página inicial (home) | http://localhost:3000 |
| Contato | http://localhost:3000/contact |
| Godroox PRO | http://localhost:3000/godroox-pro |
| Login | http://localhost:3000/login |
| Cadastro | http://localhost:3000/signup |

Ou use o menu do site (Header) para navegar.

---

## Passo 7 — Ver o dashboard (área admin)

O dashboard só aparece **depois do login** como administrador.

1. Vá em: **http://localhost:3000/login**
2. Preencha:
   - **E-mail:** `admin@godroox.com`
   - **Senha:** qualquer uma (ex.: `123` ou `senha`)
3. Clique em **Sign In** (ou equivalente).
4. Você será redirecionado para **http://localhost:3000/admin/dashboard**.

Aí você vê o **Dashboard Godroox** (métricas, transações, dupla alçada, etc.).

Para voltar ao site “público”, clique no logo Godroox no header ou acesse **http://localhost:3000**.

---

## Resumo rápido

| Ação | Comando ou URL |
|------|------------------|
| Onde rodar o projeto | `cd /Users/wellingtongomes/cursor-projects/godroox` |
| Instalar (1ª vez) | `npm install` |
| Ligar o servidor | `npm run dev` |
| Ver o site | http://localhost:3000 |
| Ver o dashboard | http://localhost:3000/login → login `admin@godroox.com` → redireciona para /admin/dashboard |

---

## Se ainda não funcionar

1. **“command not found: npm”**  
   → Instale o Node.js: https://nodejs.org (versão LTS). Feche e abra o terminal de novo.

2. **“Port 3000 is already in use”**  
   → A porta 3000 está ocupada. Ou feche o outro programa que está usando, ou rode em outra porta:
   ```bash
   npx next dev -p 3002
   ```
   Aí use **http://localhost:3002** no lugar de 3000.

3. **Página em branco ou “Não foi possível acessar o site”**  
   → Confirme que o terminal ainda está com `npm run dev` rodando e que apareceu “Ready” ou “compiled successfully”.  
   → Teste em outro navegador ou em uma aba anônima.

4. **Ao abrir /admin/dashboard vai para /login**  
   → Isso é esperado: o dashboard exige login. Use **admin@godroox.com** no login.

5. **Erro “Cannot find module” ou “Module not found”**  
   → Na pasta `godroox`, rode de novo: `npm install` e depois `npm run dev`.

6. **“listen EPERM” ou “operation not permitted” na porta 3000**  
   → Rode o servidor só em localhost (em vez de 0.0.0.0):
   ```bash
   npx next dev -H 127.0.0.1
   ```
   Depois abra **http://127.0.0.1:3000** no navegador.
