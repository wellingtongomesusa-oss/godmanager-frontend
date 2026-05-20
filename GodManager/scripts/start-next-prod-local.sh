#!/usr/bin/env bash
# Arranca Next.js em modo production garantindo DATABASE_URL da BD desejada.
# Uso (na raiz do repo ou via caminho absoluto):
#   bash scripts/start-next-prod-local.sh
# Opcional: PORT=3101 (default 3101)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -v '^[[:space:]]*$' | xargs)
  set +a
fi
export DATABASE_URL="${DATABASE_URL_PRODUCTION:-${DATABASE_URL:-}}"
if [[ -z "${DATABASE_URL}" ]]; then
  echo "start-next-prod-local: DATABASE_URL vazio. Defina DATABASE_URL_PRODUCTION em .env.local ou exporte DATABASE_URL." >&2
  exit 1
fi
exec npx next start -p "${PORT:-3101}"
