#!/usr/bin/env python3
"""
Remove blocos repetidos no início de app.py (imports + extensões + hash_password + is_password_strong truncado).

Procura o primeiro `def is_password_strong` cujo corpo contém o return completo com
has_upper, has_lower, has_digit e has_special; junta o cabeçalho inicial (até ao fim
do primeiro `hash_password`) com o código a partir desse `is_password_strong`.

Uso:
  python3 fix_app_py_header_duplication.py caminho/para/app.py

Gera app_fixed.py ao lado do ficheiro de entrada.
"""
from __future__ import annotations

import sys
from pathlib import Path


def _first_hash_password_end(lines: list[str]) -> int:
    """Índice da linha imediatamente após o primeiro bloco hash_password (exclusivo)."""
    in_hash = False
    for i, line in enumerate(lines):
        if line.startswith("def hash_password"):
            in_hash = True
            continue
        if in_hash and line and not line[0].isspace() and not line.strip().startswith("#"):
            return i
    return 26


def _good_is_password_start(lines: list[str]) -> int | None:
    marker = "return has_upper and has_lower and has_digit and has_special"
    for i, line in enumerate(lines):
        if not line.startswith("def is_password_strong"):
            continue
        block = "\n".join(lines[i : i + 20])
        if marker in block:
            return i
    return None


def repair(lines: list[str]) -> list[str]:
    good_ip = _good_is_password_start(lines)
    if good_ip is None:
        return lines
    if good_ip < 80:
        return lines

    h_end = _first_hash_password_end(lines)
    head = lines[:h_end]
    tail = lines[good_ip:]
    return head + tail


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: python3 fix_app_py_header_duplication.py <app.py>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    out_lines = repair(lines)
    out_path = path.with_name(path.stem + "_fixed" + path.suffix)
    out_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    print(f"Escrito: {out_path} ({len(out_lines)} linhas; original {len(lines)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
