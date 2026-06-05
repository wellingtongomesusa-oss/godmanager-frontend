# GodManager — i18n tooling (Pacote H base)

Ferramentas **read-only** para auditar e preparar a migração i18n do `GodManager_Premium.html`.  
**Zero impacto em runtime** — não alteram HTML, `gm-i18n.js`, `app/`, nem base de dados.

## Pré-requisitos

- Node.js 18+
- Repositório GodManager com `public/GodManager_Premium.html` e `public/gm-i18n.js`

## Comandos

```bash
# Orquestrador (recomendado — corre os 3 passos)
node scripts/i18n-tooling.mjs

# Passos individuais
node scripts/i18n-audit.mjs
node scripts/i18n-extract-candidates.mjs
node scripts/i18n-keygen.mjs   # requer .i18n-candidates.json
```

### Sugestão `package.json` (não aplicada automaticamente)

```json
"i18n:audit": "node scripts/i18n-audit.mjs",
"i18n:extract": "node scripts/i18n-extract-candidates.mjs",
"i18n:keygen": "node scripts/i18n-keygen.mjs",
"i18n:tooling": "node scripts/i18n-tooling.mjs"
```

## Outputs

| Ficheiro | Gerado por | Conteúdo |
|----------|------------|----------|
| `scripts/.i18n-audit.report.json` | audit | Órfãs, fantasmas, silos, alerts, top páginas |
| `docs/i18n-audit-2026-06-05.md` | audit | Sumário executivo em Markdown |
| `scripts/.i18n-candidates.json` | extract | Candidatos por `#page-*` e tipo |
| `scripts/.i18n-keygen.suggested.json` | keygen | Chaves hierárquicas + placeholders EN/PT/ES |

Os ficheiros `.i18n-*` em `scripts/` são artefactos locais de tooling (podem ser regenerados).

## O que cada script faz

### `i18n-audit.mjs`

- Compara chaves `gm-i18n.js` (en/pt/es) com uso em `data-i18n` e `t()`.
- Detecta chaves **órfãs** e **fantasmas** (ex.: módulo Results).
- Lista silos `LT_EXP_I18N`, `GV_I18N`, `TP_I18N`, `GM_RES_I18N` e duplicatas com gm-i18n.
- Conta texto HTML hardcoded e `alert()` / `confirm()` sem `t()`.

### `i18n-extract-candidates.mjs`

- Extrai nós de texto HTML e strings literais JS.
- Filtra códigos, datas, números, identificadores técnicos.
- Heurística de idioma (pt/en/es/unknown).
- Agrupa por `#page-*`: `html_static`, `js_dynamic`, `alerts`.

### `i18n-keygen.mjs`

- Gera chaves tipo `page.jobs.filter.month`, `common.action.save`, `alert.no_permission`.
- Deduplica strings repetidas → `common.*`.
- Placeholders: idioma detectado preenchido; outros `TODO_EN` / `TODO_PT` / `TODO_ES`.

## Garantias

- Sem `fetch`, sem Postgres, sem escrita em `public/` ou `app/`.
- Seguro correr em PROD ou com cliente em uso (só lê ficheiros do repo).

## Próximo passo (Pacote H.1+)

Após revisão do audit, implementar persistência locale e migração página a página usando `.i18n-keygen.suggested.json` como backlog.
