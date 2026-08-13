import { useEffect, useMemo, useRef, useState } from 'react';
import { dataPort } from '@data';
import type { Account } from '../types';

/**
 * Every account that has ever held money — open AND closed.
 *
 * ─ THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
 *
 * `accountService.getAccounts` fetches with `.eq('is_active', true)`, so the
 * app context holds OPEN accounts only. Closed ones are a separate call
 * (`listClosedAccounts`) that, until now, only the Accounts page ever made.
 *
 * Net worth over time was built from the context's list, so it silently
 * excluded every closed account. The owner has 110 of them, and asked the
 * question that found it: "Does my net worth over time report include closed
 * accounts?" It did not — so an account that ran from 2010 to 2020 with money
 * in it contributed NOTHING to the 2015 point. The error grows the further back
 * you look, because more of a person's closed accounts were open then, which is
 * exactly the shape of "the early years look flatter than I remember".
 *
 * ─ WHY A CLOSED ACCOUNT BELONGS IN HISTORY ─────────────────────────────────
 *
 * Closing is the Microsoft Money model this app follows: it HIDES an account
 * and preserves every transaction, and it can be reopened at any time. The
 * money was really there on the day. A chart of what you were worth that omits
 * it is answering a different question — "what my currently-open accounts were
 * worth back then" — which nobody asked.
 *
 * ─ WHY THE TRANSACTIONS NEED NO EQUIVALENT ─────────────────────────────────
 *
 * They are already loaded. `getTransactions` pages by USER, not by account, so
 * the rows belonging to closed accounts were in memory the whole time — they
 * simply had no account to attach to and fell out of the walk. That is why this
 * is a small fix rather than a second fetch of 50,000 rows.
 *
 * ─ WHAT IT DOES NOT CHANGE ─────────────────────────────────────────────────
 *
 * The Accounts list keeps its own open/closed split — that page is about what
 * you hold now and deliberately files the archive separately. This hook is for
 * surfaces that walk HISTORY.
 */
export function useHistoricalAccounts(openAccounts: Account[]): Account[] {
  const [closed, setClosed] = useState<Account[]>([]);

  /**
   * The fetch outlives the page whenever somebody navigates before it lands,
   * and a state write after that is a write to a component that no longer
   * exists. Same guard, and the same reason, as the Accounts page's own.
   */
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await dataPort.listClosedAccounts();
        if (!cancelled && isMounted.current) setClosed(rows);
      } catch {
        // Non-fatal, and it degrades to exactly the old behaviour: the history
        // is drawn from the open accounts alone. Better a chart that understates
        // than a report that refuses to render.
        if (!cancelled && isMounted.current) setClosed([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (closed.length === 0) return openAccounts;
    // Guarded against an id appearing in both lists — a reopen that races the
    // fetch would otherwise count that account's balance twice.
    const seen = new Set(openAccounts.map(a => a.id));
    return [...openAccounts, ...closed.filter(a => !seen.has(a.id))];
  }, [openAccounts, closed]);
}
