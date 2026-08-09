import { useSyncExternalStore } from 'react';
import { bankConnectionService, type BankConnection } from '../services/bankConnectionService';

/**
 * The bank connections the app has ALREADY loaded — never a fetch.
 *
 * useAccountBankSync owns the loading (and re-loading) of connections, and one
 * instance of it is mounted for the whole session from Layout. A surface that
 * only wants to READ the result — the dashboard's attention card, a register's
 * banner — must not mount a second copy of that hook: each one re-fetches
 * /api/banking/connections on mount, which is a round trip per page view for
 * data already in memory.
 *
 * The service cache is replaced wholesale on every refresh, so its array
 * identity is a sound snapshot for useSyncExternalStore: same reference until
 * something genuinely changed. Signed-out and demo sessions never load
 * connections, so this is an empty list there.
 */
const subscribe = (listener: () => void): (() => void) =>
  bankConnectionService.subscribeToConnections(listener);

const getSnapshot = (): BankConnection[] => bankConnectionService.getConnections();

export function useBankConnectionSnapshot(): BankConnection[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
