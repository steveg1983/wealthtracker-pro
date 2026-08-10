import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { dataPort } from '../services/port';
import type { Account } from '../types';

/**
 * Account-id → display name, including CLOSED accounts.
 *
 * The app context deliberately carries only open accounts, so any surface
 * that resolved names from it alone showed "Unknown account" for history in
 * closed ones — measured on real data: 43 of the 90 accounts behind the
 * uncategorised backlog were closed, every one with a perfectly good name.
 * Closed accounts read "Name (closed)"; "Unknown account" is reserved for
 * ids that genuinely resolve to nothing.
 */
export function useAccountNames(): (id: string) => string {
  const { accounts } = useApp();
  const [closed, setClosed] = useState<Account[]>([]);

  useEffect(() => {
    let cancelled = false;
    dataPort.listClosedAccounts()
      .then(list => { if (!cancelled) setClosed(list); })
      .catch(() => { /* names fall back to "Unknown account"; nothing breaks */ });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const byId = new Map<string, string>();
    closed.forEach(a => byId.set(a.id, `${a.name} (closed)`));
    // Open accounts win if an id somehow appears in both.
    accounts.forEach(a => byId.set(a.id, a.name));
    return (id: string): string => byId.get(id) ?? 'Unknown account';
  }, [accounts, closed]);
}
