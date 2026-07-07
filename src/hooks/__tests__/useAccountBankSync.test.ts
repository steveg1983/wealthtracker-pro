import { describe, it, expect } from 'vitest';
import { buildAccountBankLinks } from '../useAccountBankSync';
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
