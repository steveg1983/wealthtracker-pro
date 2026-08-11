/**
 * THE RELEASE CANNOT BE ROUTED AROUND. Enforced with a grep, on purpose.
 *
 * When one leg of a linked transfer is deleted, the survivor is released
 * (utils/transferSurvivorRelease.ts states the rule and why). That release is
 * applied in exactly one function — `AppContextSupabase.deleteTransaction` —
 * and the whole value of "one place" is that a new screen cannot get a delete
 * wrong by accident. What makes it hold is not the wiring as it stands today
 * but the fact that there is nowhere else to go: the seam's
 * `dataPort.deleteTransaction` has one caller in the whole of production, and
 * it is that function.
 *
 * WHY A GREP AND NOT A TYPE. TypeScript can say what a function takes and
 * returns; it cannot say "only this module may call you". The rule is about
 * WHERE a call may appear, so the check reads the source. Crude, and exactly
 * the right size: it fails on the diff that adds the second caller, rather than
 * in an audit after a register somewhere has been stranding rows for a year.
 *
 * The delete paths this covers, all of which reach the context and none of
 * which know anything about transfers: the register's single delete and its
 * bulk delete, the phone's swipe on both lists, the global transactions list
 * (its row button, its right-click menu), the full editor, the duplicate sweep,
 * and the compensating deletes the transfer writers use when a second leg fails
 * to arrive.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

/** The seam's own definition of the operation, as opposed to a use of it. */
const DEFINITION_FILES = new Set([
  path.join(SRC, 'services', 'port', 'dataPort.ts'),
  path.join(SRC, 'services', 'port', 'index.ts'),
  path.join(SRC, 'services', 'api', 'dataService.ts'),
  path.join(SRC, 'services', 'api', 'transactionService.ts'),
  // States the rule; naming the call in prose must not trip the rule.
  path.join(SRC, 'utils', 'transferSurvivorRelease.ts'),
]);

const isTestPath = (file: string): boolean =>
  /(^|[\\/])__tests__[\\/]/.test(file) ||
  /\.(test|spec)\.tsx?$/.test(file) ||
  /(^|[\\/])src[\\/]test[\\/]/.test(file);

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      productionFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Files calling `<something>.deleteTransaction(` on the seam or the service. */
const callers = (pattern: RegExp): string[] => {
  const found: string[] = [];
  for (const file of productionFiles(SRC)) {
    if (DEFINITION_FILES.has(file)) continue;
    if (pattern.test(readFileSync(file, 'utf8'))) found.push(path.relative(SRC, file));
  }
  return found.sort();
};

describe('the delete every screen uses', () => {
  it('reaches the seam from ONE place, which is where the release lives', () => {
    expect(callers(/\bdataPort\.deleteTransaction\s*\(/)).toEqual([
      path.join('contexts', 'AppContextSupabase.tsx'),
    ]);
  });

  it('is never reached by going round the seam to the service', () => {
    // DataService.deleteTransaction and TransactionService.deleteTransaction do
    // the store's work — remove the row, reverse the balance, unlink whatever
    // pointed at it — and nothing above that. A screen calling either of them
    // directly would delete a leg and leave the survivor filed as a transfer
    // with nothing on the other side.
    expect(callers(/\b(DataService|TransactionService)\.deleteTransaction\s*\(/)).toEqual([]);
  });

  it('is never answered with the browser\'s own confirm', () => {
    // window.confirm cannot be styled, cannot be tested, drops focus on the
    // body, and — the reason it matters here — has room for one question and
    // two answers, which is one answer short for a transfer. The global
    // transactions list used one until this stream; nothing that deletes a
    // transaction may again.
    //
    // Deliberately narrow: three pages outside this rule still ask with a
    // native confirm (Accounts, settings/Categories, settings/Tags). They
    // delete accounts, categories and tags, not transactions, and widening the
    // rule to them here would be claiming a sweep that has not happened.
    const offenders = productionFiles(SRC)
      .filter(file => {
        const source = readFileSync(file, 'utf8');
        return /window\.confirm\s*\(/.test(source) && /\bdeleteTransaction\s*\(/.test(source);
      })
      .map(file => path.relative(SRC, file))
      .sort();
    expect(offenders).toEqual([]);
  });
});
