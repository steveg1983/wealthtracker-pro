/**
 * Where `/transactions` goes now that the global transactions page is retired.
 *
 * ─ WHY A REDIRECT AND NOT A 404 ────────────────────────────────────────────
 * The address is in the wild. Notifications raised by older builds carry it as
 * their stored `actionUrl` (see useActivityLogger — those records are
 * serialised to localStorage and read back by builds that had not shipped when
 * they were written), and so do bookmarks, the phone's home-screen shortcuts,
 * and anything a user ever pasted into a note. "There is nothing at that
 * address" would be true and useless.
 *
 * ─ THE RULES ───────────────────────────────────────────────────────────────
 *   ?account=<id>   that account's register — the only deep link the old page
 *                   ever honoured, and the register IS where the link was
 *                   always trying to get to.
 *   anything else   /accounts, the list of registers.
 *
 * THE QUERY STRING SURVIVES, which is the load-bearing part: `?demo=true`
 * dropped mid-navigation bounces a demo session to the landing page, and every
 * other parameter belongs to whoever wrote the link.
 *
 * `account` is spent on the way through: it has chosen the destination, and
 * leaving it on would put a stale filter parameter in the address bar of a
 * register that does not read one.
 *
 * ─ THE ONE PARAMETER THAT IS TRANSLATED, AND WHY ───────────────────────────
 * `?action=add` on `/transactions` meant "add a TRANSACTION" — that page had
 * one kind of thing in it. On `/accounts`, where this link now lands, the same
 * three letters already mean "add an ACCOUNT" (Accounts.tsx reads them), so
 * carrying the word through unchanged would take a user who asked for a
 * transaction and hand them the new-account dialog. Preserving a parameter's
 * TEXT while destroying its MEANING is not preservation.
 *
 * So it is renamed to the app-wide, unambiguous form Layout honours on any page
 * (`action=add-transaction`), here — at the one boundary that still knows which
 * page the link was written for.
 *
 * A function of its own, in a module of its own, because the component beside
 * it (LegacyTransactionsRedirect) may not export both — a file that exports
 * components and functions together breaks fast refresh.
 */
export interface LegacyDestination {
  pathname: string;
  search: string;
}

export function legacyTransactionsDestination(search: string): LegacyDestination {
  const params = new URLSearchParams(search);

  if (params.get('action') === 'add') {
    params.set('action', 'add-transaction');
  }

  const accountId = params.get('account');
  if (accountId !== null && accountId !== '') {
    params.delete('account');
    return { pathname: `/accounts/${accountId}`, search: params.toString() };
  }
  return { pathname: '/accounts', search: params.toString() };
}
