#!/usr/bin/env bash
# Gera GodManager_Full_Project_*.zip em ~/Downloads (exclui node_modules, .next, .git, etc.)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "${DIR}/make_godmanager_zip.py"
