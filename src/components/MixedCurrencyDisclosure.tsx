import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { dataPort } from '@data';
import type { Account } from '../types';

/**
 * PHASE 0 of the currency programme (the disclosure ruling, 22 Aug §2):
 * a surface whose totals still sum native units says so, until its
 * conversion phase arrives.
 *
 * The ruling's four-state table — convert-and-mark, exclude-and-say,
 * sum-native-AND-SAY, sum-native-silently — has exactly one unacceptable
 * row, and it is the one every P2–P5 surface was in. This line moves a
 * surface to the third row for the cost of a sentence: "quietly wrong"
 * becomes "honestly limited", and each later phase upgrades a stated
 * limitation into a conversion instead of breaking a silence.
 *
 * Renders NOTHING for a single-currency ledger (the data-health rule: the
 * overwhelmingly common case has no limitation to state). The check spans
 * CLOSED accounts, because the totals this qualifies span their history.
 * One line per page, under the page's primary total — when a surface
 * converts, its mount of this line is deleted in the same commit.
 */

/**
 * Whether ANY account — open or closed — is held in something other than
 * the display currency. Closed included for the measured reason the name
 * and currency lookups include them: history lives there.
 */
export function useLedgerSpansCurrencies(): boolean {
  const { accounts } = useApp();
  const { displayCurrency } = useCurrencyDecimal();
  const [closed, setClosed] = useState<Account[]>([]);

  useEffect(() => {
    let cancelled = false;
    dataPort.listClosedAccounts()
      .then(list => { if (!cancelled) setClosed(list); })
      .catch(() => { /* the open accounts still answer; nothing breaks */ });
    return () => { cancelled = true; };
  }, []);

  return useMemo(
    () =>
      accounts.some(a => (a.currency || displayCurrency) !== displayCurrency) ||
      closed.some(a => (a.currency || displayCurrency) !== displayCurrency),
    [accounts, closed, displayCurrency]
  );
}

export default function MixedCurrencyDisclosure({
  className = '',
}: {
  className?: string;
}): React.JSX.Element | null {
  const spans = useLedgerSpansCurrencies();
  const { displayCurrency } = useCurrencyDecimal();

  if (!spans) return null;

  return (
    <p
      className={`text-dense text-gray-500 dark:text-gray-400 ${className}`.trim()}
      data-testid="mixed-currency-disclosure"
    >
      Totals here mix currencies: amounts in another currency are counted
      unit-for-unit, not converted into {displayCurrency}.
    </p>
  );
}
