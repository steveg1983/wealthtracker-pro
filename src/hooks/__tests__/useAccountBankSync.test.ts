import { describe, it, expect } from 'vitest';
import { buildAccountBankLinks, countFeedsNeedingAttention } from '../useAccountBankSync';
import type { BankConnection } from '../../services/bankConnectionService';

function makeConnection(overrides: Partial<BankConnection>): BankConnection {
  return {
    id: 'conn-1',
    provider: 'truelayer',
    institutionId: 'inst-1',
    institutionName: 'Test Bank',
    status: 'connected',
    accounts: [],
    linkedAccountIds: [],
    ...overrides
  };
}

describe('buildAccountBankLinks', () => {
  it('returns an empty map when there are no connections', () => {
    expect(buildAccountBankLinks([]).size).toBe(0);
  });

  it('maps each linked account id to its connection metadata', () => {
    const lastSync = new Date('2026-07-01T09:30:00Z');
    const links = buildAccountBankLinks([
      makeConnection({
        id: 'conn-a',
        institutionName: 'Monzo',
        status: 'connected',
        lastSync,
        linkedAccountIds: ['acc-1', 'acc-2']
      })
    ]);

    expect(links.size).toBe(2);
    expect(links.get('acc-1')).toEqual({
      connectionId: 'conn-a',
      institutionName: 'Monzo',
      status: 'connected',
      lastSync
    });
    // A single bank login backing several accounts shares the same connection.
    expect(links.get('acc-2')?.connectionId).toBe('conn-a');
  });

  it('preserves reauth_required status so the UI can prompt a reconnect', () => {
    const links = buildAccountBankLinks([
      makeConnection({ id: 'conn-b', status: 'reauth_required', linkedAccountIds: ['acc-9'] })
    ]);
    expect(links.get('acc-9')?.status).toBe('reauth_required');
  });

  it('does not create entries for connections with no linked accounts', () => {
    const links = buildAccountBankLinks([
      makeConnection({ id: 'conn-c', linkedAccountIds: [] })
    ]);
    expect(links.size).toBe(0);
  });

  it('lets a later connection win when an account id appears twice', () => {
    const links = buildAccountBankLinks([
      makeConnection({ id: 'conn-old', linkedAccountIds: ['acc-x'] }),
      makeConnection({ id: 'conn-new', linkedAccountIds: ['acc-x'] })
    ]);
    expect(links.get('acc-x')?.connectionId).toBe('conn-new');
  });
});

/**
 * ─ WHICH FEEDS COUNT AS BROKEN ─────────────────────────────────────────────
 *
 * This number decides whether the Accounts page's "Bank connections" button
 * goes amber. The owner asked for it after finding a dead link only by opening
 * the bank-feeds page: "would it be possible to change the colour ... if any of
 * my account links have an error?"
 */
describe('countFeedsNeedingAttention', () => {
  it('counts an outright error', () => {
    expect(countFeedsNeedingAttention([makeConnection({ status: 'error' })])).toBe(1);
  });

  it('counts an EXPIRED CONSENT too — the failure that looks like nothing', () => {
    /*
     * The one worth being deliberate about. `reauth_required` shows no error
     * anywhere on the Accounts page: the feed simply stops and the balances go
     * quietly stale, which is indistinguishable from an account nobody has
     * spent from. If anything deserves the amber it is this.
     */
    expect(countFeedsNeedingAttention([makeConnection({ status: 'reauth_required' })])).toBe(1);
  });

  it('does not count healthy connections', () => {
    expect(countFeedsNeedingAttention([
      makeConnection({ id: 'a', status: 'connected' }),
      makeConnection({ id: 'b', status: 'connected' }),
    ])).toBe(0);
  });

  it('counts each broken connection once, and ignores the healthy ones beside them', () => {
    // The owner's own shape: one dead Revolut among two working banks.
    expect(countFeedsNeedingAttention([
      makeConnection({ id: 'revolut', status: 'error' }),
      makeConnection({ id: 'amex', status: 'connected' }),
      makeConnection({ id: 'hsbc', status: 'connected' }),
    ])).toBe(1);
  });

  it('is 0 for no connections at all, which is the desktop edition', () => {
    expect(countFeedsNeedingAttention([])).toBe(0);
  });
});
