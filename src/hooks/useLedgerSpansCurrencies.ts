import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { dataPort } from '@data';
import type { Account } from '../types';

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

