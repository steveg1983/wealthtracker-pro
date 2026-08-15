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
import { sectionTypeForAccount } from './accountGrouping';

/**
 * The sections whose accounts are somebody's debt, so cannot be a TARGET.
 *
 * Read through `sectionTypeForAccount` rather than off `type` directly, which
 * is what makes the aliases behave: 'mortgage' files under Loans, 'checking'
 * under Current, 'assets' under Assets. A hand-rolled type set gets all three
 * wrong, and gets them wrong silently.
 *
 * 'other' is NOT here. It is the catch-all for a type with no section of its
 * own, so it means "unclassified", not "not a debt" — excluding it would drop
 * legitimate targets on the guess that they might be liabilities.
 */
export const LIABILITY_SECTIONS: ReadonlySet<string> = new Set(['credit', 'loan', 'liability']);

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
  const options = accounts.filter(a =>
    !LIABILITY_SECTIONS.has(sectionTypeForAccount(a.type)) &&
    a.id !== account.id &&
    a.isActive !== false
  );

  // A target that has since been closed stays listed, or saving any other
  // change on the form would silently drop the link.
  const current = account.securedAgainstAccountId
    ? accounts.find(a => a.id === account.securedAgainstAccountId)
    : undefined;
  if (current && !options.some(a => a.id === current.id)) options.push(current);

  return { offered: options.length > 0, options };
}
