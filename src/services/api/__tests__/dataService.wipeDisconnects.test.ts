/**
 * "DELETE ALL DATA" MEANS ALL OF IT, INCLUDING THE BANK CONNECTIONS.
 *
 * The owner deleted everything and watched two accounts come back, with 487
 * transactions to review and a sync timestamp from a minute later. His
 * question was the right one: "surely if it is delete all data, it is delete
 * all data?"
 *
 * The accounts HAD gone. `WIPE_TABLE_ORDER` deletes them, and the note above it
 * said so plainly — "bank connections themselves are kept" — so the connection
 * outlived the ledger and the next feed sync recreated the accounts and
 * re-imported their history.
 *
 * That is the worst shape a destructive action can have: not a refusal, which
 * a person can see, but a quiet under-delivery that leaves them believing the
 * ledger is empty when it is not.
 *
 * Removed through `disconnect` rather than a SQL delete of our own, so there is
 * one path and both callers take it.
 *
 * What that path does and does not do, checked rather than assumed: it deletes
 * the `bank_connections` row, scoped to the user, and nothing else. There is no
 * provider-side revocation anywhere in `api/banking/`. So after a wipe the app
 * has forgotten the bank and the bank has not forgotten the app — enough to
 * stop the resurrection these tests are about, and NOT the same thing as
 * withdrawing consent. Worth saying here because a test file claiming the
 * stronger property would be the reason nobody ever added it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataService, type BankingEngineLike } from '../dataService';

const wipeCloudData = vi.fn(async () => {});
const wipeUserFinancialData = vi.fn(async () => ({}));
const disconnect = vi.fn(async () => ({ removed: true, revokedAtProvider: true }));
const refreshConnections = vi.fn(async () => [{ id: 'conn-1' }, { id: 'conn-2' }]);

vi.mock('../../transactionCache', () => ({
  transactionCache: { clear: vi.fn(async () => {}) },
}));

function serviceWith(banking: BankingEngineLike) {
  return createDataService({
    userIdService: { getCurrentDatabaseUserId: () => 'user-1' } as never,
    // `isSupabaseConfigured`, which is the option's real name. Written as
    // `supabaseChecker` (the private field's name) it was silently ignored —
    // an unknown key on an options object is not an error — so the service
    // fell through to the REAL checker: true on a machine with Supabase env
    // vars, false in CI. The suite passed locally and failed on the runner,
    // asserting nothing either way, because the cloud branch was never taken.
    isSupabaseConfigured: () => true,
    cloudClient: {} as never,
    msMoneyEngine: { wipeCloudData } as never,
    cloudBackup: { wipeUserFinancialData } as never,
    banking,
  });
}

const workingBank = (): BankingEngineLike => ({
  bankConnectionService: { refreshConnections, disconnect },
});

describe('a wipe revokes every bank connection', () => {
  beforeEach(() => {
    wipeCloudData.mockClear();
    wipeUserFinancialData.mockClear();
    disconnect.mockClear();
    refreshConnections.mockClear();
    refreshConnections.mockResolvedValue([{ id: 'conn-1' }, { id: 'conn-2' }]);
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: true });
  });

  it('disconnects each one, so nothing is left to recreate the accounts', async () => {
    await serviceWith(workingBank()).wipeAllFinancialData();

    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledWith('conn-1');
    expect(disconnect).toHaveBeenCalledWith('conn-2');
  });

  it('still wipes the ledger first — the order is not incidental', async () => {
    await serviceWith(workingBank()).wipeAllFinancialData();

    // The rows go before the consent: a wipe that revoked first and then failed
    // would leave a full ledger with no way to refresh it.
    expect(wipeCloudData).toHaveBeenCalled();
    expect(wipeUserFinancialData).toHaveBeenCalled();
    const wipeOrder = wipeCloudData.mock.invocationCallOrder[0];
    expect(disconnect.mock.invocationCallOrder[0]).toBeGreaterThan(wipeOrder);
  });

  it('says so when a bank refuses, instead of leaving it to resurrect the ledger', async () => {
    disconnect.mockImplementation(async (id: string) => {
      if (id === 'conn-2') throw new Error('provider unavailable');
      return { removed: true, revokedAtProvider: true };
    });

    await expect(serviceWith(workingBank()).wipeAllFinancialData()).rejects.toThrow(
      /could not be disconnected/i
    );
  });

  it('tries every connection even after one fails', async () => {
    disconnect.mockImplementation(async (id: string) => {
      if (id === 'conn-1') throw new Error('provider unavailable');
      return { removed: true, revokedAtProvider: true };
    });

    await expect(serviceWith(workingBank()).wipeAllFinancialData()).rejects.toThrow();

    // One bank being down must not leave the others connected.
    expect(disconnect).toHaveBeenCalledWith('conn-2');
  });

  it('names the remedy, since the ledger is already gone by then', async () => {
    disconnect.mockRejectedValue(new Error('nope'));

    await expect(serviceWith(workingBank()).wipeAllFinancialData()).rejects.toThrow(
      /Open Banking page/
    );
  });

  it('completes when there are no connections to revoke', async () => {
    refreshConnections.mockResolvedValue([]);

    await expect(serviceWith(workingBank()).wipeAllFinancialData()).resolves.toBeUndefined();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('does not fail the whole wipe when the connection list cannot be read', async () => {
    refreshConnections.mockRejectedValue(new Error('offline'));

    // The ledger is already deleted at this point. Refusing the wipe over a
    // list we cannot fetch would report a failure that did not happen.
    await expect(serviceWith(workingBank()).wipeAllFinancialData()).resolves.toBeUndefined();
  });
});
