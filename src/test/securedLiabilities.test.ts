/**
 * SECURED LIABILITIES — a link that must never become a sum.
 *
 * `securedAgainstAccountId` records that a mortgage is held against a property,
 * or a loan against the portfolio it is drawn on. The whole risk of the feature
 * is that it starts behaving like `parentAccountId`, which nests AND counts.
 * If it ever did, a house would silently be restated as its equity.
 *
 * So these tests pin the two things that make it safe: the nesting utilities do
 * not see it at all, and the backup carries it through the id remap that a
 * restore performs — the second because a link that survives export and dies on
 * restore is worse than one that was never stored.
 */
import { describe, it, expect } from 'vitest';
import {
  buildChildrenByParent,
  selectTopLevelAccounts,
  buildTopLevelIdByAccountId
} from '../utils/accountNesting';
import { extractAccountParents, buildBackupBundle, remapBackupIds } from '../services/backup/format';
import { resolveSecuring, normaliseSecuredIds, buildSecuredByTarget } from '../utils/accountSecuring';
import { mapAccountToDb } from '../services/api/accountMapping';
import type { Account } from '../types';

/** The nesting utilities read exactly two fields; this carries a third. */
const property = { id: 'prop-1', parentAccountId: null, securedAgainstAccountIds: [] };
const mortgage = { id: 'debt-1', parentAccountId: null, securedAgainstAccountIds: ['prop-1'] };
const cashSleeve = { id: 'cash-1', parentAccountId: 'inv-1', securedAgainstAccountIds: [] };
const portfolio = { id: 'inv-1', parentAccountId: null, securedAgainstAccountIds: [] };

const all = [property, mortgage, cashSleeve, portfolio];

describe('securing does not nest, and does not count', () => {
  it('puts no secured liability in anybody\'s children', () => {
    const children = buildChildrenByParent(all);
    // The cash sleeve nests, because it belongs inside and its money is part
    // of the portfolio. The mortgage does not, because neither is true of it.
    expect(children.get('inv-1')?.map(a => a.id)).toEqual(['cash-1']);
    expect(children.has('prop-1')).toBe(false);
  });

  it('leaves the liability top-level, so it still renders under Liabilities', () => {
    // The owner's constraint, in one assertion: "I don't want the liabilities
    // to move from the liabilities area on the accounts page."
    expect(selectTopLevelAccounts(all).map(a => a.id))
      .toEqual(['prop-1', 'debt-1', 'inv-1']);
  });

  it('does not route the debt\'s money toward the asset it is secured against', () => {
    // buildTopLevelIdByAccountId is what band totals are grouped by, so this is
    // the assertion that stops a mortgage being subtracted from a house.
    const roots = buildTopLevelIdByAccountId(all);
    expect(roots.get('debt-1')).toBe('debt-1');
    expect(roots.get('cash-1')).toBe('inv-1'); // the pairing still does count
  });
});

describe('which accounts may be secured, and against what', () => {
  /*
   * The owner's own mortgage is typed CURRENT. It is unmistakably a mortgage,
   * it carries a negative balance, and the app's type says current account —
   * which is what a decade of Microsoft Money imports actually looks like.
   *
   * The first cut gated the control on loan/credit/other and so showed nothing
   * at all on that account. These pin the rule that replaced it.
   */
  // Built as real Accounts rather than cast into shape: a cast here would let
  // the fixture drift from the type the function actually receives, which is
  // the one thing these tests exist to be sure about.
  const acc = (
    id: string,
    type: Account['type'],
    extra: Partial<Account> = {}
  ): Account => ({
    id,
    name: id,
    type,
    balance: 0,
    currency: 'GBP',
    lastUpdated: new Date('2026-08-15T00:00:00.000Z'),
    ...extra
  });

  const ledger = [
    acc('mortgage-as-current', 'current'),   // the owner's real shape
    acc('property', 'assets'),               // alias: files under Assets
    acc('portfolio', 'investment'),
    acc('visa', 'credit'),                   // a debt — never a target
    acc('personal-loan', 'loan'),            // a debt — never a target
    acc('mortgage-proper', 'mortgage'),      // alias: files under Loans
    acc('misc', 'other')                     // unclassified — still a target
  ];

  it('offers the control on a mortgage typed as a current account', () => {
    // The bug, in one assertion.
    expect(resolveSecuring(ledger[0], ledger).offered).toBe(true);
  });

  it('offers DEBTS as targets too (owner, 16 August)', () => {
    /*
     * This test used to assert the opposite. The owner borrows in and lends
     * the same money out, files the loan-out under Liabilities to keep every
     * loan in one section, and wants the two tagged — a debt netting another
     * debt. The link is display-only, so nothing was being protected by the
     * exclusion except an accounting convention his filing does not follow.
     */
    const targets = resolveSecuring(ledger[0], ledger).options.map(a => a.id);
    expect(targets).toContain('visa');
    expect(targets).toContain('personal-loan');
    expect(targets).toContain('mortgage-proper');
  });

  it('offers assets, investments and unclassified accounts', () => {
    const targets = resolveSecuring(ledger[0], ledger).options.map(a => a.id);
    // 'assets' is an alias for the Assets section — the owner's property.
    expect(targets).toEqual(expect.arrayContaining(['property', 'portfolio', 'misc']));
  });

  it('never offers the account itself', () => {
    expect(resolveSecuring(ledger[1], ledger).options.map(a => a.id)).not.toContain('property');
  });

  it('keeps a closed target listed, so saving does not silently drop the link', () => {
    const closed = acc('sold-house', 'assets', { isActive: false });
    const debt = acc('debt', 'loan', { securedAgainstAccountIds: ['sold-house'] });
    const targets = resolveSecuring(debt, [debt, closed]).options.map(a => a.id);
    expect(targets).toContain('sold-house');
  });
});

describe('a debt held against SEVERAL accounts', () => {
  /*
   * The owner's case: a loan drawn against two investment portfolios, labelled
   * against both without tying the two portfolios to each other.
   *
   * The arithmetic trap lives here. A liability names N targets, so anything
   * that iterates LINKS rather than LIABILITIES counts the debt N times — and
   * on a portfolio page that is millions removed from a total for a debt that
   * exists once.
   */
  const debt = { id: 'loan', securedAgainstAccountIds: ['inv-a', 'inv-b'] };
  const invA = { id: 'inv-a', securedAgainstAccountIds: [] };
  const invB = { id: 'inv-b', securedAgainstAccountIds: [] };

  it('appears under every account it is secured against', () => {
    const byTarget = buildSecuredByTarget([debt, invA, invB]);
    expect(byTarget.get('inv-a')?.map(a => a.id)).toEqual(['loan']);
    expect(byTarget.get('inv-b')?.map(a => a.id)).toEqual(['loan']);
  });

  it('does not link the two targets to each other', () => {
    // The owner's words: "not tie the investments together, just put a label
    // against both of them." Neither portfolio names anything.
    const byTarget = buildSecuredByTarget([debt, invA, invB]);
    expect(byTarget.has('loan')).toBe(false);
    expect(invA.securedAgainstAccountIds).toEqual([]);
  });

  it('skips a target that is not present — closed, filtered or deleted', () => {
    // The column has no foreign key, so a deleted account leaves its id behind.
    // All three cases look the same here and want the same answer.
    const byTarget = buildSecuredByTarget([debt, invA]);
    expect(byTarget.get('inv-a')?.map(a => a.id)).toEqual(['loan']);
    expect(byTarget.has('inv-b')).toBe(false);
  });

  it('counts a duplicated target once, and drops blanks and self-references', () => {
    // A duplicate is the one fault that would do arithmetic damage: the same
    // portfolio chosen twice would subtract the loan twice.
    expect(normaliseSecuredIds(['inv-a', 'inv-a', '', null, 'loan', 'inv-b'], 'loan'))
      .toEqual(['inv-a', 'inv-b']);
  });

  it('lists a doubly-linked debt once under each target, never twice under one', () => {
    const doubled = { id: 'loan', securedAgainstAccountIds: ['inv-a', 'inv-a'] };
    expect(buildSecuredByTarget([doubled, invA]).get('inv-a')?.length).toBe(1);
  });
});

describe('the write path names a real column', () => {
  /*
   * `mapAccountToDb` falls back to `?? field` for anything it has no mapping
   * for, so an unmapped camelCase name is sent to PostgREST verbatim. PostgREST
   * rejects the WHOLE update, which means one missing line here breaks saving
   * an account entirely — including edits to fields the user did touch.
   *
   * That is what shipped: the read path was mapped, the write path was not,
   * and the owner got "Could not find the 'securedAgainstAccountId' column of
   * 'accounts' in the schema cache" while renaming an account type.
   */
  it('maps securedAgainstAccountIds to its snake_case column', () => {
    expect(mapAccountToDb({ securedAgainstAccountIds: ['prop-1', 'inv-1'] }))
      .toEqual({ secured_against_account_ids: ['prop-1', 'inv-1'] });
  });

  it('sends an EMPTY array through, because [] is how every link is cleared', () => {
    // `undefined` means "leave alone" and is dropped; [] must survive, or
    // unlinking the last target would silently leave it linked.
    expect(mapAccountToDb({ securedAgainstAccountIds: [] }))
      .toEqual({ secured_against_account_ids: [] });
  });

  it('emits no camelCase key for any account field it maps', () => {
    // The general form of the bug, so the next field added cannot repeat it.
    const columns = mapAccountToDb({
      securedAgainstAccountIds: ['a'],
      parentAccountId: 'b',
      openingBalanceDate: new Date('2026-01-01T00:00:00.000Z')
    });
    for (const key of Object.keys(columns)) {
      expect(key, `${key} is not a snake_case column name`).not.toMatch(/[A-Z]/);
    }
  });
});

describe('the backup carries the link through a restore', () => {
  /*
   * Restores REMAP every id — global primary keys collide across logins — and
   * account→account references are re-applied afterwards from a side channel.
   * A new reference that is not in that channel restores as null, silently.
   */
  it('extracts an ordinary parent link', () => {
    expect(extractAccountParents([{ id: 'cash-1', parent_account_id: 'inv-1' }]))
      .toEqual([{ id: 'cash-1', parent_account_id: 'inv-1' }]);
  });

  it('emits nothing for an account with no parent', () => {
    expect(extractAccountParents([{ id: 'plain-1' }])).toEqual([]);
  });

  it('REMAPS EVERY id in the secured array, not just the first', () => {
    /*
     * The one that would fail silently. `ENTITY_REFERENCES` declares which
     * columns hold ids that a restore must translate; a new account→account
     * column missing from that list survives export, survives validation, and
     * restores pointing at an id from the OLD login — which resolves to
     * nothing, so the link is simply gone and no error is raised anywhere.
     *
     * Written after watching the earlier tests here stay green while the
     * column was deleted from that list.
     */
    const bundle = buildBackupBundle({
      sourceUserId: 'user-1',
      exportedAt: '2026-08-15T00:00:00.000Z',
      data: {
        accounts: [
          { id: 'prop-1', name: 'Flat 3' },
          { id: 'inv-1', name: 'Portfolio' },
          { id: 'debt-1', name: 'Mortgage', secured_against_account_ids: ['prop-1', 'inv-1'] }
        ]
      },
      preferences: null
    });

    const { bundle: remapped } = remapBackupIds(bundle, (() => {
      let n = 0;
      return () => `new-${++n}`;
    })());

    const property = remapped.data.accounts.find(r => r.name === 'Flat 3');
    const portfolio = remapped.data.accounts.find(r => r.name === 'Portfolio');
    const debt = remapped.data.accounts.find(r => r.name === 'Mortgage');

    expect(property?.id).toBe('new-1');
    expect(portfolio?.id).toBe('new-2');
    // The point: BOTH follow their targets to the new ids. A remap that
    // handled element 0 and stopped would restore the second link dangling.
    expect(debt?.secured_against_account_ids).toEqual(['new-1', 'new-2']);
  });
});
