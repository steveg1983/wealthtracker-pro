/**
 * "Needs Your Attention" — the rules, at fixed instants.
 *
 * The card's history is the reason this file exists: membership was decided by
 * one rule and the words under the name were written by another, so a threshold
 * of anything but £500 produced a row with a name and no explanation, and the
 * screen-reader label announced "High utilization" regardless. Every case below
 * asserts the SENTENCE, because the sentence is what makes the row exist.
 *
 * Every figure, name and institution here is invented.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAttentionItems,
  formatTimeSince,
  type AttentionBankLink,
} from './attentionItems';
import type { Account } from '../types';

const NOW = new Date('2026-05-20T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const account = (over: Partial<Account> & { id: string; name: string }): Account => ({
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-05-01T00:00:00.000Z'),
  ...over,
});

/** A deliberately plain formatter, so assertions read as the figures given. */
const formatMoney = (amount: number): string => `£${amount.toFixed(2)}`;

interface BuildOptions {
  accounts: Account[];
  balances?: Record<string, number>;
  links?: Record<string, AttentionBankLink>;
  mode?: 'off' | 'signin' | 'daily';
  now?: Date;
}

const build = ({ accounts, balances = {}, links = {}, mode = 'daily', now = NOW }: BuildOptions) =>
  buildAttentionItems({
    accounts,
    balanceOf: (id) => balances[id] ?? 0,
    linkOf: (id) => links[id],
    autoSyncMode: mode,
    formatMoney,
    now,
  });

const link = (over: Partial<AttentionBankLink> = {}): AttentionBankLink => ({
  connectionId: 'conn-1',
  institutionName: 'Sample Bank',
  status: 'connected',
  lastSync: new Date(NOW.getTime() - HOUR),
  ...over,
});

describe('formatTimeSince', () => {
  it('counts elapsed milliseconds, never calendar days', () => {
    // 40 minutes before midnight and 40 minutes after are the same distance.
    const justAfterMidnight = new Date('2026-05-20T00:20:00.000Z');
    const beforeMidnight = new Date('2026-05-19T23:40:00.000Z');
    expect(formatTimeSince(beforeMidnight, justAfterMidnight)).toBe('40 minutes ago');
  });

  it('scales from a moment to days, singular where it should be', () => {
    expect(formatTimeSince(new Date(NOW.getTime() - 5_000), NOW)).toBe('a moment ago');
    expect(formatTimeSince(new Date(NOW.getTime() - 60_000), NOW)).toBe('1 minute ago');
    expect(formatTimeSince(new Date(NOW.getTime() - HOUR), NOW)).toBe('1 hour ago');
    expect(formatTimeSince(new Date(NOW.getTime() - 5 * HOUR), NOW)).toBe('5 hours ago');
    expect(formatTimeSince(new Date(NOW.getTime() - 25 * HOUR), NOW)).toBe('1 day ago');
    expect(formatTimeSince(new Date(NOW.getTime() - 100 * HOUR), NOW)).toBe('4 days ago');
  });
});

describe('buildAttentionItems — low balance', () => {
  const armed = account({
    id: 'acc-a',
    name: 'Feed Account A',
    lowBalanceAlertEnabled: true,
    lowBalanceThreshold: 123.45,
  });

  it('names the balance and the threshold the user actually chose', () => {
    const [item] = build({ accounts: [armed], balances: { 'acc-a': 20 } });

    expect(item.kind).toBe('low-balance');
    expect(item.reason).toBe('Down to £20.00 — below the £123.45 you asked to be warned at.');
    expect(item.href).toBe('/accounts/acc-a');
    expect(item.actionLabel).toBe('Open register');
  });

  it('says nothing while the balance is at or above the threshold', () => {
    expect(build({ accounts: [armed], balances: { 'acc-a': 123.45 } })).toEqual([]);
    expect(build({ accounts: [armed], balances: { 'acc-a': 500 } })).toEqual([]);
  });

  it('says nothing when the alert is off or has no threshold', () => {
    const off = account({ ...armed, id: 'acc-b', lowBalanceAlertEnabled: false });
    const none = account({ ...armed, id: 'acc-c', lowBalanceThreshold: undefined });
    expect(build({ accounts: [off, none], balances: { 'acc-b': 0, 'acc-c': 0 } })).toEqual([]);
  });
});

describe('buildAttentionItems — credit utilisation', () => {
  const card = account({ id: 'card-1', name: 'Sample Card', type: 'credit', creditLimit: 1000 });

  it('reports the share of the limit in use', () => {
    const [item] = build({ accounts: [card], balances: { 'card-1': -810 } });

    expect(item.kind).toBe('credit-utilisation');
    expect(item.reason).toBe('Using 81% of the £1000.00 limit.');
    expect(item.href).toBe('/accounts/card-1');
  });

  it('leaves a card IN CREDIT alone', () => {
    // The regression: Math.abs() read a credit balance as debt, so the one
    // card owing nothing was the one that got warned.
    expect(build({ accounts: [card], balances: { 'card-1': 810 } })).toEqual([]);
  });

  it('stays quiet at or below the limit it warns above', () => {
    expect(build({ accounts: [card], balances: { 'card-1': -700 } })).toEqual([]);
    expect(build({ accounts: [card], balances: { 'card-1': -701 } })).toHaveLength(1);
  });

  it('never joins a low-balance row — one account, one row', () => {
    const armedCard = account({
      ...card,
      lowBalanceAlertEnabled: true,
      lowBalanceThreshold: -100,
    });
    const items = build({ accounts: [armedCard], balances: { 'card-1': -900 } });

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('low-balance');
  });
});

describe('buildAttentionItems — stale feeds', () => {
  const plain = account({ id: 'acc-a', name: 'Feed Account A' });

  it('allows a day and a little for a daily schedule', () => {
    const fresh = build({
      accounts: [plain],
      links: { 'acc-a': link({ lastSync: new Date(NOW.getTime() - 25 * HOUR) }) },
      mode: 'daily',
    });
    expect(fresh).toEqual([]);

    const [item] = build({
      accounts: [plain],
      links: { 'acc-a': link({ lastSync: new Date(NOW.getTime() - 27 * HOUR) }) },
      mode: 'daily',
    });
    expect(item.kind).toBe('feed-stale');
    expect(item.reason).toBe(
      "Balances may be out of date — Sample Bank hasn't been able to refresh since 1 day ago."
    );
    expect(item.href).toBe('/open-banking');
    expect(item.actionLabel).toBe('Check the feed');
  });

  it('allows a working morning for a refresh-on-sign-in schedule', () => {
    const links = { 'acc-a': link({ lastSync: new Date(NOW.getTime() - 5 * HOUR) }) };
    expect(build({ accounts: [plain], links, mode: 'signin' })).toEqual([]);

    const stale = { 'acc-a': link({ lastSync: new Date(NOW.getTime() - 7 * HOUR) }) };
    expect(build({ accounts: [plain], links: stale, mode: 'signin' })).toHaveLength(1);
  });

  it('says nothing at all when automatic refresh is off', () => {
    // The user turned it off. Complaining about the consequence of their own
    // setting — every day, forever — is how a warning becomes noise.
    const ancient = { 'acc-a': link({ lastSync: new Date('2020-01-01T00:00:00.000Z') }) };
    expect(build({ accounts: [plain], links: ancient, mode: 'off' })).toEqual([]);
    expect(build({ accounts: [plain], links: { 'acc-a': link({ lastSync: undefined }) }, mode: 'off' })).toEqual([]);
  });

  it('treats a feed that has never run as what it is', () => {
    const [item] = build({
      accounts: [plain],
      links: { 'acc-a': link({ lastSync: undefined }) },
    });
    expect(item.kind).toBe('feed-stale');
    expect(item.reason).toBe(
      'Sample Bank has never completed a refresh, so this balance is whatever was last entered by hand.'
    );
  });

  it('speaks once per connection, however many accounts it backs', () => {
    const b = account({ id: 'acc-b', name: 'Feed Account B' });
    const c = account({ id: 'acc-c', name: 'Feed Account C' });
    const shared = link({ lastSync: new Date(NOW.getTime() - 48 * HOUR) });
    const items = build({
      accounts: [b, c],
      links: { 'acc-b': shared, 'acc-c': shared },
    });

    expect(items).toHaveLength(1);
    // Attached to the first account it backs, so the row still has a name.
    expect(items[0].account.id).toBe('acc-b');
  });

  it('keeps separate connections separate', () => {
    const b = account({ id: 'acc-b', name: 'Feed Account B' });
    const c = account({ id: 'acc-c', name: 'Feed Account C' });
    const items = build({
      accounts: [b, c],
      links: {
        'acc-b': link({ connectionId: 'conn-1', lastSync: undefined }),
        'acc-c': link({ connectionId: 'conn-2', institutionName: 'Second Bank', lastSync: undefined }),
      },
    });

    expect(items.map(i => i.account.id)).toEqual(['acc-b', 'acc-c']);
    expect(items[1].reason).toContain('Second Bank');
  });
});

describe('buildAttentionItems — composition', () => {
  const armed = account({
    id: 'acc-a',
    name: 'Feed Account A',
    lowBalanceAlertEnabled: true,
    lowBalanceThreshold: 123.45,
  });

  it('says both facts in one row, not two rows about one account', () => {
    const items = build({
      accounts: [armed],
      balances: { 'acc-a': 20 },
      links: { 'acc-a': link({ lastSync: new Date(NOW.getTime() - 48 * HOUR) }) },
    });

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('low-balance');
    expect(items[0].reason).toBe(
      'Down to £20.00 — below the £123.45 you asked to be warned at. ' +
      "Balances may be out of date: Sample Bank hasn't refreshed since 2 days ago."
    );
  });

  it('drops the connection row even when another account reached it first', () => {
    // Order of accounts must not decide whether the card repeats itself.
    const quiet = account({ id: 'acc-z', name: 'Feed Account Z' });
    const shared = link({ lastSync: new Date(NOW.getTime() - 48 * HOUR) });
    const items = build({
      accounts: [quiet, armed],
      balances: { 'acc-a': 20 },
      links: { 'acc-z': shared, 'acc-a': shared },
    });

    expect(items).toHaveLength(1);
    expect(items[0].account.id).toBe('acc-a');
  });

  it('composes the never-refreshed wording too', () => {
    const [item] = build({
      accounts: [armed],
      balances: { 'acc-a': 20 },
      links: { 'acc-a': link({ lastSync: undefined }) },
    });
    expect(item.reason).toContain('Balances may be out of date: Sample Bank has never completed a refresh.');
  });
});

describe('buildAttentionItems — reauthorisation', () => {
  const plain = account({ id: 'acc-a', name: 'Feed Account A' });
  const broken = link({ status: 'reauth_required', lastSync: new Date(NOW.getTime() - 72 * HOUR) });

  it('asks for the sign-in and dates the silence', () => {
    const [item] = build({ accounts: [plain], links: { 'acc-a': broken } });

    expect(item.kind).toBe('feed-reauth');
    expect(item.reason).toBe(
      'Sample Bank needs you to sign in again — nothing new has come through since 3 days ago.'
    );
    expect(item.href).toBe('/open-banking');
    expect(item.actionLabel).toBe('Reconnect bank');
  });

  it('still asks when automatic refresh is off — a broken login is not a schedule', () => {
    const items = build({ accounts: [plain], links: { 'acc-a': broken }, mode: 'off' });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('feed-reauth');
  });

  it('replaces the staleness row for the same connection', () => {
    const items = build({ accounts: [plain], links: { 'acc-a': broken } });
    expect(items.filter(i => i.kind === 'feed-stale')).toEqual([]);
  });

  it('handles a connection that never delivered anything', () => {
    const [item] = build({
      accounts: [plain],
      links: { 'acc-a': link({ status: 'reauth_required', lastSync: undefined }) },
    });
    expect(item.reason).toBe(
      'Sample Bank needs you to sign in again — nothing has come through from it yet.'
    );
  });
});

describe('buildAttentionItems — the shape of the result', () => {
  it('reads the clock it is given and no other', () => {
    const plain = account({ id: 'acc-a', name: 'Feed Account A' });
    const links = { 'acc-a': link({ lastSync: new Date('2026-05-19T00:00:00.000Z') }) };

    expect(build({ accounts: [plain], links, now: new Date('2026-05-19T12:00:00.000Z') })).toEqual([]);
    expect(build({ accounts: [plain], links, now: new Date('2026-05-20T12:00:00.000Z') })).toHaveLength(1);
  });

  it('never produces a row without a sentence', () => {
    const items = build({
      accounts: [
        account({ id: 'acc-a', name: 'Feed Account A', lowBalanceAlertEnabled: true, lowBalanceThreshold: 250 }),
        account({ id: 'card-1', name: 'Sample Card', type: 'credit', creditLimit: 500 }),
        account({ id: 'acc-b', name: 'Feed Account B' }),
        account({ id: 'acc-quiet', name: 'Feed Account Q' }),
      ],
      balances: { 'acc-a': 10, 'card-1': -450, 'acc-b': 999 },
      links: {
        'acc-b': link({ connectionId: 'conn-9', institutionName: 'Third Bank', lastSync: undefined }),
      },
    });

    expect(items).toHaveLength(3);
    items.forEach(item => {
      expect(item.reason.trim().length).toBeGreaterThan(0);
      expect(item.actionLabel.trim().length).toBeGreaterThan(0);
    });
    // Account rows first, in account order, then the connection rows.
    expect(items.map(i => i.kind)).toEqual(['low-balance', 'credit-utilisation', 'feed-stale']);
  });

  it('returns nothing for a set of healthy, unlinked accounts', () => {
    const items = build({
      accounts: [account({ id: 'acc-a', name: 'Feed Account A' })],
      balances: { 'acc-a': 1000 },
    });
    expect(items).toEqual([]);
  });
});
