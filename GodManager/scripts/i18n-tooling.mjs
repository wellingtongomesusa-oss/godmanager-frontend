#!/usr/bin/env node
/**
 * Orchestrator: audit → extract → keygen (read-only tooling).
 */
import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const STEPS = [
  { name: 'audit', script: 'i18n-audit.mjs', out: '.i18n-audit.report.json' },
  { name: 'extract', script: 'i18n-extract-candidates.mjs', out: '.i18n-candidates.json' },
  { name: 'keygen', script: 'i18n-keygen.mjs', out: '.i18n-keygen.suggested.json' },
];

function runStep(step) {
  const path = join(__dir, step.script);
  const res = spawnSync(node, [path], { encoding: 'utf8', cwd: join(__dir, '..') });
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
    throw new Error(`${step.name} failed with exit ${res.status}`);
  }
  const outPath = join(__dir, step.out);
  if (!existsSync(outPath)) throw new Error(`Missing output: ${step.out}`);
  JSON.parse(readFileSync(outPath, 'utf8'));
  return { step: step.name, out: step.out, ok: true };
}

function main() {
  const results = [];
  for (const step of STEPS) {
    results.push(runStep(step));
  }
  const audit = JSON.parse(readFileSync(join(__dir, '.i18n-audit.report.json'), 'utf8'));
  console.log(
    JSON.stringify(
      {
        ok: true,
        steps: results,
        summary: audit.summary,
        docs: 'docs/i18n-audit-2026-06-05.md',
        npmScriptSuggestion: 'i18n:tooling: node scripts/i18n-tooling.mjs',
      },
      null,
      2,
    ),
  );
}

main();
