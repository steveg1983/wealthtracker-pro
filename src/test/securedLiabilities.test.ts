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
import { resolveSecuring } from '../utils/accountSecuring';
import type { Account } from '../types';

/** The nesting utilities read exactly two fields; this carries a third. */
const property = { id: 'prop-1', parentAccountId: null, securedAgainstAccountId: null };
const mortgage = { id: 'debt-1', parentAccountId: null, securedAgainstAccountId: 'prop-1' };
const cashSleeve = { id: 'cash-1', parentAccountId: 'inv-1', securedAgainstAccountId: null };
const portfolio = { id: 'inv-1', parentAccountId: null, securedAgainstAccountId: null };

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

  it('never offers a debt as the thing to be secured against', () => {
    const targets = resolveSecuring(ledger[0], ledger).options.map(a => a.id);
    expect(targets).not.toContain('visa');
    expect(targets).not.toContain('personal-loan');
    // Through the alias, which is the half a hand-rolled type set gets wrong:
    // 'mortgage' files under Loans.
    expect(targets).not.toContain('mortgage-proper');
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
    const debt = acc('debt', 'loan', { securedAgainstAccountId: 'sold-house' });
    const targets = resolveSecuring(debt, [debt, closed]).options.map(a => a.id);
    expect(targets).toContain('sold-house');
  });
});

describe('the backup carries the link through a restore', () => {
  /*
   * Restores REMAP every id — global primary keys collide across logins — and
   * account→account references are re-applied afterwards from a side channel.
   * A new reference that is not in that channel restores as null, silently.
   */
  it('extracts a liability that has only a secured link and no parent', () => {
    // The case that a parent-shaped extractor drops on the floor, which is ALL
    // of them: securing deliberately does not nest, so there is never a parent.
    const links = extractAccountParents([
      { id: 'debt-1', secured_against_account_id: 'prop-1' }
    ]);
    expect(links).toEqual([
      { id: 'debt-1', parent_account_id: null, secured_against_account_id: 'prop-1' }
    ]);
  });

  it('still extracts an ordinary parent link, and both together', () => {
    expect(extractAccountParents([{ id: 'cash-1', parent_account_id: 'inv-1' }]))
      .toEqual([{ id: 'cash-1', parent_account_id: 'inv-1' }]);

    expect(extractAccountParents([
      { id: 'x', parent_account_id: 'p', secured_against_account_id: 's' }
    ])).toEqual([{ id: 'x', parent_account_id: 'p', secured_against_account_id: 's' }]);
  });

  it('emits nothing for an account with neither link', () => {
    expect(extractAccountParents([{ id: 'plain-1' }])).toEqual([]);
  });

  it('REMAPS the secured id on the account row, not just the link', () => {
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
          { id: 'debt-1', name: 'Mortgage', secured_against_account_id: 'prop-1' }
        ]
      },
      preferences: null
    });

    const { bundle: remapped } = remapBackupIds(bundle, (() => {
      let n = 0;
      return () => `new-${++n}`;
    })());

    const property = remapped.data.accounts.find(r => r.name === 'Flat 3');
    const debt = remapped.data.accounts.find(r => r.name === 'Mortgage');

    expect(property?.id).toBe('new-1');
    expect(debt?.id).toBe('new-2');
    // The point: it follows the property to its NEW id.
    expect(debt?.secured_against_account_id).toBe('new-1');
    expect(debt?.secured_against_account_id).not.toBe('prop-1');
  });
});
