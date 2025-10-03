#!/usr/bin/env node
/*
 * Phase 1: Replace console.error/warn with logger.error/warn in src/**
 * - Skips tests by default (we only walk src/)
 * - Adds import { logger } from '<relative>/services/loggingService'
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const LOGGER_PATH = path.join(SRC, 'services', 'loggingService');

/** Return all files under dir matching extensions */
function walk(dir, exts = new Set(['.ts', '.tsx'])) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip known directories with tests or mocks
      if (/__tests__/.test(entry.name)) continue;
      walk(full, exts).forEach(f => out.push(f));
    } else if (exts.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Compute relative import path from file to loggingService (no extension) */
function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, LOGGER_PATH).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function processFile(file) {
  // Skip the logger itself and the console shim
  if (file.endsWith('/services/loggingService.ts')) return { skipped: true };
  if (file.endsWith('/setup/consoleToLogger.ts')) return { skipped: true };

  let src = fs.readFileSync(file, 'utf8');

  // Quick exit if no target patterns
  if (!src.includes('console.error(') && !src.includes('console.warn(')) return { skipped: true };

  // Do naive replacements (avoid replacing in comments/strings would require AST; keep scope narrow)
  const replaced = src
    .replace(/console\.error\s*\(/g, 'logger.error(')
    .replace(/console\.warn\s*\(/g, 'logger.warn(');

  if (replaced === src) return { skipped: true };

  // Ensure import is present
  if (!/\blogger\b/.test(replaced) || !/from\s+['"][^'"]+loggingService['"]/g.test(replaced)) {
    const importLine = `import { logger } from '${relImport(file)}'`;
    // Insert after last import
    const lines = replaced.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\b/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine + ';');
    } else {
      lines.unshift(importLine + ';');
    }
    const final = lines.join('\n');
    fs.writeFileSync(file, final, 'utf8');
  } else {
    fs.writeFileSync(file, replaced, 'utf8');
  }

  return { modified: true };
}

function main() {
  const files = walk(SRC);
  let modified = 0;
  let skipped = 0;
  for (const f of files) {
    const res = processFile(f);
    if (res?.modified) modified++;
    else skipped++;
  }
  console.log(`Phase 1 codemod complete. Modified: ${modified}, skipped: ${skipped}`);
}

main();

