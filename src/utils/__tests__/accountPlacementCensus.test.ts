import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * THE ACCOUNT-PLACEMENT CENSUS — every file that decides WHERE an account's
 * money belongs must say whether it asked the module that owns that answer.
 *
 * ─ THE FAULT THIS EXISTS TO CATCH ─────────────────────────────────────────
 *
 * `utils/accountNesting`'s own header says its rules are "the whole answer to
 * where does this account's money belong, so two pages can never disagree
 * about what a paired account is worth". The balance reports never called it.
 * They grouped by the row's own `type`, so a cash sleeve inside a portfolio
 * appeared under Current accounts and inflated that total, while the same
 * account sat inside Investments one page over. Same money, two homes, and
 * nothing on either screen to say which was the lie. Found 25 Aug by the
 * owner asking for a feature, not by any test.
 *
 * Design named the general form, which now has four instances (`bg-theme-
 * accent`, the checkbox `min-width`, the button `inline-flex`, this):
 *
 *   A module that claims to be the single source of an answer is only that
 *   if every caller asks it. An uncalled authority is a comment, and a
 *   comment cannot be contradicted by a screen — only a reader can.
 *
 * ─ WHY THIS DETECTOR AND NOT ANOTHER ──────────────────────────────────────
 *
 * Grepping for `parentAccountId` would NOT have caught it: the balance report
 * never mentioned the field. What it did was declare its own table mapping
 * account TYPES to display bands — a second placement authority, standing
 * beside `accountGrouping`'s and answering the same question differently.
 *
 * So the signal is the table, not the field. A file that knows four or more
 * of the account-type names is either placing accounts or describing the type
 * system, and both are worth a human having classified once.
 *
 * ─ WHAT THIS CANNOT SEE ───────────────────────────────────────────────────
 *
 * A file that places accounts using types it holds in a variable, or that
 * handles one or two types only, uses no such table and passes unseen. The
 * fence covers the shape the real fault had; this paragraph is the honest
 * statement of the gap, in the same spirit as the currency census's.
 *
 * Statuses:
 * - 'resolves'        — asks accountNesting before it places anything
 * - 'flat-by-design'  — places accounts and deliberately does NOT nest, with
 *                       the reason recorded beside it. A legitimate answer:
 *                       a picker that must offer every account, a settings
 *                       form that is editing one account's own type
 * - 'not-a-placement' — knows the type names for another purpose entirely
 *                       (a schema, a validator, a parser, a fixture) and
 *                       never decides where an account's money sits
 */

const TYPE_NAMES = ['current', 'savings', 'credit', 'loan', 'investment'] as const;

/**
 * A type name written as a STRING LITERAL or as an OBJECT KEY — both are how
 * a placement table is spelled, and the first draft of this census only
 * looked for the first. A fabricated `{ current: 'A', savings: 'B', … }`
 * walked straight past it, which is the shape half these tables take.
 */
const declaresType = (source: string, name: string): boolean =>
  new RegExp(`(['"])${name}\\1|\\b${name}\\s*:`).test(source);

type Status = 'resolves' | 'flat-by-design' | 'not-a-placement';

const LEDGER: Record<string, Status> = {
  // ── the authorities themselves ──
  // The nesting rules. A definition is not a call site.
  'src/utils/accountGrouping.ts': 'flat-by-design',
  // ^ Sections and their order. It groups by TYPE and says so; the CALLER
  //   decides which accounts to hand it, and a caller that wants nesting
  //   resolves it first (Accounts page) rather than this module guessing.
  'src/utils/accountSections.ts': 'flat-by-design',
  // ^ The same sections wearing icons. Re-exports the above; adds no rule.

  // ── surfaces that place money, and resolve nesting to do it ──
  'src/utils/accountBalanceReport.ts': 'resolves',

  // ── surfaces that place accounts and deliberately stay flat ──
  // Editing ONE account's own type. Nesting is a different field on the same
  // form, and this list is the type picker, not a placement of money.
  'src/components/AccountSettingsModal.tsx': 'flat-by-design',
  // Creating an account. It has no parent yet and no balance to place.
  'src/components/AddAccountModal.tsx': 'flat-by-design',
  // Mapping a bank's discovered accounts onto ours. Every account must be
  // offerable as a link target, including a nested one — hiding children
  // would make a real sleeve unlinkable.
  'src/components/banking/LinkBankAccountsModal.tsx': 'flat-by-design',

  // ── files that know the type names for another purpose ──
  'src/types/accountType.ts': 'not-a-placement',        // the union itself
  'src/types/schemas.ts': 'not-a-placement',            // runtime validation
  'src/services/validationService.ts': 'not-a-placement',
  'src/lib/supabase.ts': 'not-a-placement',             // row types
  'src/services/exportService.ts': 'not-a-placement',   // serialises what it is given
  'src/services/ofxImportService.ts': 'not-a-placement', // maps OFX codes inward
  'src/data/defaultTestData.ts': 'not-a-placement',
  'src/data/newTestData.ts': 'not-a-placement',
  'src/utils/testDataset.ts': 'not-a-placement',
  'src/services/api/accountMapping.ts': 'not-a-placement', // DB row → Account
};

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

/** Files that name four or more account types — the table shape. */
function census(): string[] {
  const files: string[] = [];
  walk(SRC, files);
  return files
    .filter(file => {
      const source = readFileSync(file, 'utf8');
      return TYPE_NAMES.filter(name => declaresType(source, name)).length >= 4;
    })
    .map(file => relative(process.cwd(), file).split('\\').join('/'))
    .sort();
}

describe('account-placement census — no unclassified second authority', () => {
  it('every file that knows the account types is classified', () => {
    const unclassified = census().filter(file => !(file in LEDGER));
    expect(
      unclassified,
      `These files name four or more account types and are not in the ledger. ` +
      `Each one is either placing accounts — in which case it must ask ` +
      `utils/accountNesting where a paired account's money belongs, or state ` +
      `why it deliberately stays flat — or it knows the names for another ` +
      `reason and is 'not-a-placement'. Say which, in the ledger above, so the ` +
      `next uncalled authority is found by reading. Unclassified: ` +
      `${unclassified.join(', ')}`
    ).toEqual([]);
  });

  it('the ledger names no file that has gone away', () => {
    // A stale entry is how a ledger stops describing the code it audits.
    const present = new Set(census());
    const stale = Object.keys(LEDGER).filter(file => !present.has(file));
    expect(stale, `Ledger entries with no matching file: ${stale.join(', ')}`).toEqual([]);
  });

  it("a file classified 'resolves' really does ask the nesting module", () => {
    // The status is a claim about the code, so it is checked rather than
    // trusted — otherwise the ledger records intentions.
    for (const [file, status] of Object.entries(LEDGER)) {
      if (status !== 'resolves') continue;
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, `${file} is recorded as 'resolves' but imports no nesting`)
        .toMatch(/from '\.{1,2}\/(utils\/)?accountNesting'/);
    }
  });

  it('the census is looking at real files (never vacuously green)', () => {
    expect(census().length).toBeGreaterThan(8);
  });
});
