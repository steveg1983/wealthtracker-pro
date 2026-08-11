/**
 * THE GLOBAL TRANSACTIONS PAGE IS GONE, AND SO IS EVERYTHING ONLY IT USED.
 *
 * Transactions are worked on in the register of the account that owns them. The
 * global page was a browsable copy of every register, which meant every
 * register feature had to be built twice — and the second copy was always the
 * poor relation (its bulk-selection mode turned out to be unreachable code that
 * nothing could ever switch on). The one job it really did, "which account was
 * that in?", is Find's.
 *
 * A deletion is only finished when nothing still reaches for what was deleted.
 * The build proves that for the app; this proves it for the whole tree,
 * including test files, which the build never compiles — and it fails loudly if
 * one of these modules is quietly reintroduced by name.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const SELF = path.join(SRC, 'test', 'globalTransactionsPageRetired.test.ts');

/**
 * The retired modules, by the path an import would name them with.
 *
 * The bare-word check would be useless here — `SwipeableTransactionRow` (the
 * phone's row, alive and well) and `HeldTransactionRow` (an import type)
 * both contain "TransactionRow" — so what is checked is the module SPECIFIER,
 * segment by segment.
 */
const RETIRED = [
  'pages/Transactions',
  'components/TransactionRow',
  'components/TransactionDetailsView',
  'components/QuickDateFilters',
  'components/TransactionContextMenu',
  'components/MarkdownNote',
  'hooks/useTransactionFilters',
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(abs);
  }
  return out;
}

/** Every module specifier a file names, however it names it. */
const SPECIFIER = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|vi\.mock\(\s*['"]([^'"]+)['"]/g;

describe('the retired global transactions page', () => {
  it('has no files left behind', () => {
    for (const module of RETIRED) {
      for (const extension of ['.ts', '.tsx']) {
        expect(fs.existsSync(path.join(SRC, `${module}${extension}`))).toBe(false);
      }
    }
  });

  it('is imported by nothing at all', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      if (file === SELF) continue;
      const body = fs.readFileSync(file, 'utf8');
      SPECIFIER.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SPECIFIER.exec(body)) !== null) {
        const specifier = match[1] ?? match[2] ?? match[3] ?? '';
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
        // Compare the tail of the specifier against each retired module, so a
        // relative hop ('../../components/TransactionRow') is caught wherever
        // it is written from, and a longer name that merely ends the same way
        // ('components/SwipeableTransactionRow') is not.
        const normalised = specifier.replace(/\.(ts|tsx|js|jsx)$/, '');
        const retired = RETIRED.find(module => normalised === module || normalised.endsWith(`/${module}`));
        if (retired) offenders.push(`${path.relative(SRC, file)} → ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
