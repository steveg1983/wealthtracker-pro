/**
 * WHAT AN ACCOUNT MAY BE RECORDED AS HELD AGAINST — a mortgage against its
 * property, a loan drawn against a portfolio.
 *
 * A leaf module beside `accountNesting`, and for the same two reasons: the
 * rule is consumed by more than the dialog that edits it, and a rule living
 * inside a component is a rule the next page reimplements slightly differently.
 *
 * The relationship this describes is DISPLAY-ONLY. It moves nothing between
 * sections and adds nothing to any total — see `Account.securedAgainstAccountId`
 * and migration 20260815200000 for why it is not `parentAccountId`, which does
 * both.
 */
import type { Account } from '../types';

/** What the field may offer this account, and whether it appears at all. */
export interface SecuringState {
  offered: boolean;
  options: Account[];
}

/**
 * ─ WHY THE CONTROL IS NOT GATED ON THIS ACCOUNT'S TYPE ─────────────────────
 *
 * It was, at first — offered only on loan/credit/other, on the reasonable
 * theory that only a debt is secured against anything. The owner then opened
 * his "Mortgage - Corporation Avenue" and found no control at all, because
 * that account is typed CURRENT in his ledger. It is unmistakably a mortgage,
 * it carries a negative balance, and the app's own type says current account.
 * So are the rest of his debts: the Microsoft Money import gave every one of
 * them the same type.
 *
 * That will be corrected in his data, and this stays ungated anyway. An
 * account's type in an imported ledger is a WEAK SIGNAL, and a gate built on a
 * weak signal hides the feature in exactly the cases it was built for. The
 * link is display-only, so the cost of offering it too widely is a dropdown
 * somebody ignores, while the cost of offering it too narrowly is a feature
 * that does not work on the owner's own mortgage.
 *
 * Nested accounts ARE offered, unlike the investment↔cash pairing, and that
 * asymmetry is deliberate too. Pairing refuses them because nesting a nested
 * account makes a chain that has to be walked and could cycle. Securing walks
 * nothing — one hop, read for display — so a loan may perfectly well be held
 * against a cash sleeve inside a portfolio.
 */
export function resolveSecuring(
  account: Account,
  accounts: readonly Account[]
): SecuringState {
  /*
   * ANY open account except itself — debts included, as of 16 August.
   *
   * The first cut excluded liabilities as targets, on the theory that a debt
   * cannot be secured against a debt. The owner's ledger says otherwise: he
   * borrows in and lends the same money out, files the loan-out under
   * Liabilities to keep every loan in one section, and wants the two tagged —
   * a debt read as NETTING another debt rather than as an asset inflating both
   * totals. The link is display-only either way, so the exclusion was
   * protecting nothing except an accounting convention his filing does not
   * follow.
   */
  const options = accounts.filter(a =>
    a.id !== account.id &&
    a.isActive !== false
  );

  // A target that has since been closed stays listed, or saving any other
  // change on the form would silently drop the link.
  for (const id of account.securedAgainstAccountIds ?? []) {
    if (options.some(a => a.id === id)) continue;
    const current = accounts.find(a => a.id === id);
    if (current) options.push(current);
  }

  return { offered: options.length > 0, options };
}

/**
 * The stored list, cleaned: no blanks, no duplicates, nothing pointing at the
 * account itself.
 *
 * Both the form and every reader go through this, because the three faults it
 * removes arrive from different directions — a blank from an untouched "add
 * another" row, a duplicate from picking the same account twice, and a
 * self-reference from an account that was retyped after being linked. A
 * duplicate is the one that would do arithmetic damage if it ever reached the
 * Investments page, so it is removed at the source rather than guarded against
 * at each use.
 */
export function normaliseSecuredIds(
  ids: readonly (string | null | undefined)[],
  selfId?: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || id === selfId || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Target account id → the liabilities secured against it.
 *
 * Deliberately NOT built with `buildChildrenByParent`, even though the shape
 * is nearly identical. That helper answers "where does this account's money
 * belong", and the answer for a secured liability is "exactly where it already
 * is". Everything downstream of the nesting utilities is right to count what
 * it groups, so this must not travel through any of it.
 *
 * A target that is not in `accounts` is skipped — closed, filtered out of the
 * current view, or deleted (the column has no foreign key). All three look the
 * same from here and all three want the same answer: a row keyed under a card
 * that is not on the page is a row nobody sees.
 */
export function buildSecuredByTarget<T extends {
  id: string;
  securedAgainstAccountIds?: string[];
}>(accounts: readonly T[]): Map<string, T[]> {
  const present = new Set(accounts.map(a => a.id));
  const map = new Map<string, T[]>();
  for (const account of accounts) {
    for (const targetId of normaliseSecuredIds(account.securedAgainstAccountIds ?? [], account.id)) {
      if (!present.has(targetId)) continue;
      const list = map.get(targetId);
      if (list) list.push(account);
      else map.set(targetId, [account]);
    }
  }
  return map;
}
