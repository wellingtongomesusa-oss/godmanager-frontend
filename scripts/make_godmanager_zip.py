#!/usr/bin/env python3
"""Create GodManager_Full_Project_*.zip in ~/Downloads (excludes node_modules, .next, etc.)."""
from __future__ import annotations

import os
import sys
import zipfile
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDE_DIRS = {"node_modules", ".next", ".git", "__pycache__", ".venv", "venv"}
EXCLUDE_FILES = {".DS_Store", ".env", ".env.local", ".env.production", ".env.development"}

DIRS = ["GodManager", "website", "app", "components", "lib", "public"]
ROOT_FILES = [
    "package.json",
    "next.config.js",
    "middleware.ts",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js",
    "next-env.d.ts",
    "package-lock.json",
    "README.md",
    ".eslintrc.json",
    ".gitignore",
    ".env.example",
]


def should_skip(rel_parts: tuple[str, ...]) -> bool:
    for part in rel_parts:
        if part in EXCLUDE_DIRS or part.startswith(".env"):
            return True
    return False


def main() -> int:
    downloads = os.path.expanduser("~/Downloads")
    os.makedirs(downloads, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = os.path.join(downloads, f"GodManager_Full_Project_{ts}.zip")

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirname in DIRS:
            base = os.path.join(ROOT, dirname)
            if not os.path.isdir(base):
                continue
            for dirpath, dirnames, filenames in os.walk(base):
                # prune excluded dirs in-place
                dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith(".env")]
                rel_dir = os.path.relpath(dirpath, ROOT)
                parts = tuple(rel_dir.split(os.sep)) if rel_dir != "." else ()
                if should_skip(parts):
                    continue
                for fn in filenames:
                    if fn in EXCLUDE_FILES:
                        continue
                    if fn.startswith(".env") and fn != ".env.example":
                        continue
                    fp = os.path.join(dirpath, fn)
                    arc = os.path.relpath(fp, ROOT)
                    zf.write(fp, arc)

        for fn in ROOT_FILES:
            fp = os.path.join(ROOT, fn)
            if os.path.isfile(fp):
                zf.write(fp, fn)

    size = os.path.getsize(out)
    print(f"{out}")
    print(f"{size} bytes ({size / (1024 * 1024):.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
