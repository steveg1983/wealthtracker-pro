/**
 * The seam between the two account services.
 *
 * The app loads accounts through simpleAccountService at boot and through
 * accountService on every import, sync, realtime refresh and settings save.
 * While each service kept its OWN row mapper, an account changed shape
 * depending on which one had last run — and the bugs that caused could not be
 * seen from inside either file. Each test below is one of those bugs, written
 * against the real consumer wherever the consumer could be imported: the real
 * Account Settings modal, the real OFX identifier matcher.
 *
 * Every figure and identifier here is invented.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountSettingsModal from '../../components/AccountSettingsModal';
import { createSimpleAccountService } from '../api/simpleAccountService';
import { createAccountService } from '../api/accountService';
import { findAccountByOfxIdentifiers } from '../../utils/ofxAccountIdentifiers';
import type { Account, AccountUpdate } from '../../types';

const USER_ID = 'u2222222-2222-4222-8222-222222222222';
const ACCOUNT_ID = 'a1111111-1111-4111-8111-111111111111';

/** One stored account, with every column both mappers ever knew about set. */
const accountRow = (): Record<string, unknown> => ({
  id: ACCOUNT_ID,
  user_id: USER_ID,
  name: 'Everyday Current',
  // The database's spelling of 'current'.
  type: 'checking',
  balance: 120.5,
  currency: 'GBP',
  institution: 'Invented Bank',
  is_active: true,
  initial_balance: 0,
  opening_balance_date: '2024-01-01',
  sort_code: '11-22-33',
  account_number: '87654321',
  notes: 'Opened when the flat was bought',
  low_balance_alert_enabled: true,
  low_balance_threshold: '250.00',
  bank_balance: 120.5,
  bank_balance_date: '2026-08-01',
  last_reconciled_date: '2026-08-01',
  archive_through_date: null,
  parent_account_id: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2026-08-01T09:00:00.000Z'
});

/**
 * A stand-in for the `accounts` table that behaves the way PostgREST does in
 * the two respects these tests depend on: an update writes the columns it is
 * given and nothing else, and `.select()` after it returns the row as it now
 * stands. That is what makes the round trips below real — the account the app
 * ends up holding is mapped from what was actually written.
 */
const createAccountsTable = (initial: Record<string, unknown> = accountRow()) => {
  let row: Record<string, unknown> = { ...initial };
  const writes: Record<string, unknown>[] = [];

  const rowResult = async () => ({ data: { ...row }, error: null });

  const afterUpdate = {
    eq: () => afterUpdate,
    select: () => ({ single: rowResult })
  };

  const selectAll = {
    eq: () => selectAll,
    single: rowResult,
    order: async () => ({ data: [{ ...row }], error: null })
  };

  const selectType = {
    eq: () => selectType,
    single: async () => ({ data: { type: row.type }, error: null })
  };

  const table = {
    select: (columns: string) => (columns === 'type' ? selectType : selectAll),
    update: (payload: Record<string, unknown>) => {
      writes.push(payload);
      row = { ...row, ...payload };
      return afterUpdate;
    },
    insert: (payload: Record<string, unknown>) => {
      row = { ...row, ...payload };
      return afterUpdate;
    }
  };

  return {
    from: (name: string) => {
      if (name !== 'accounts') throw new Error(`unexpected table ${name}`);
      return table;
    },
    /** Every column payload sent to the database, in order. */
    writes,
    stored: () => ({ ...row })
  };
};

type AccountsTable = ReturnType<typeof createAccountsTable>;

/**
 * The stub as the services' client option. A single assertion, not a double
 * one: the real client satisfies `{ from(name: string): unknown }`, which is
 * what makes this a legal narrowing rather than a hole in the type system.
 */
type ClientLike = Parameters<typeof createAccountService>[0] extends
  { supabaseClient?: infer C } ? C : never;

const asClient = (table: { from: (name: string) => unknown }): ClientLike =>
  table as ClientLike;

const storage = () => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => {})
});

const silent = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** The service the app boots through (AppContextSupabase line ~396). */
const bootService = (table: AccountsTable) => createSimpleAccountService({
  supabaseClient: asClient(table),
  storageAdapter: storage(),
  userIdService: {
    getDatabaseUserId: vi.fn(async () => USER_ID),
    ensureUserExists: vi.fn(async () => USER_ID)
  },
  logger: silent
});

/** The service every refresh, import and save comes back through. */
const refreshService = (table: AccountsTable) => createAccountService({
  supabaseClient: asClient(table),
  isSupabaseConfigured: () => true,
  storageAdapter: storage(),
  logger: silent
});

describe('one account mapper, both load paths', () => {
  it('gives the same account whichever service loaded it', async () => {
    const table = createAccountsTable();

    const [atBoot] = await bootService(table).getAccounts(USER_ID);
    const [afterRefresh] = await refreshService(table).getAccounts(USER_ID);

    // The whole point: an account's shape must not depend on which service
    // happened to fetch it. Field-by-field, not key-by-key, so an extra
    // snake_case key riding along counts as a difference too.
    expect(atBoot).toEqual(afterRefresh);
    expect(atBoot.type).toBe('current');
  });

  it('carries every field the app reads, from either service', async () => {
    const table = createAccountsTable();
    const [atBoot] = await bootService(table).getAccounts(USER_ID);
    const [afterRefresh] = await refreshService(table).getAccounts(USER_ID);

    for (const account of [atBoot, afterRefresh]) {
      expect(account.sortCode).toBe('11-22-33');
      expect(account.accountNumber).toBe('87654321');
      expect(account.lowBalanceAlertEnabled).toBe(true);
      expect(account.lowBalanceThreshold).toBe(250);
      expect(account.openingBalanceDate).toBeInstanceOf(Date);
      expect(account.bankBalanceDate).toBe('2026-08-01');
      expect(account.notes).toBe('Opened when the flat was bought');
      expect(account.institution).toBe('Invented Bank');
    }
  });

  it('sends the same columns for the same edit, whichever service writes it', async () => {
    const viaBoot = createAccountsTable();
    const viaRefresh = createAccountsTable();
    const edit: AccountUpdate = {
      name: 'Renamed',
      type: 'current',
      lowBalanceAlertEnabled: true,
      lowBalanceThreshold: 250,
      lastUpdated: new Date('2026-08-08T00:00:00.000Z')
    };

    await bootService(viaBoot).updateAccount(ACCOUNT_ID, edit);
    await refreshService(viaRefresh).updateAccount(ACCOUNT_ID, edit, USER_ID);

    expect(viaBoot.writes[0]).toEqual(viaRefresh.writes[0]);
    // Named columns, not camelCase field names: PostgREST rejects the whole
    // update if one column does not exist, taking the user's real edit with it.
    expect(viaBoot.writes[0]).toMatchObject({
      name: 'Renamed',
      type: 'checking',
      low_balance_alert_enabled: true,
      low_balance_threshold: 250
    });
    // `accounts` has no `last_updated` column. The app's lastUpdated is
    // updated_at, which is what the backup writer has always said.
    expect(viaBoot.writes[0]).not.toHaveProperty('last_updated');
    expect(viaBoot.writes[0]).toHaveProperty('updated_at');
    expect(viaBoot.writes[0]).not.toHaveProperty('lowBalanceAlertEnabled');
  });
});

describe('the low-balance alert the dashboard raises', () => {
  it('is readable on the account the app boots with', async () => {
    const table = createAccountsTable();
    const [account] = await bootService(table).getAccounts(USER_ID);

    // The dashboard's own condition, copied verbatim from
    // components/dashboard/ImprovedDashboard.tsx (the accountsNeedingAttention
    // filter). Boot used to map neither field, so this was false for every
    // account until something else happened to reload them.
    const balance = 120.5;
    const needsAttention = Boolean(
      account.lowBalanceAlertEnabled &&
      account.lowBalanceThreshold != null &&
      balance < account.lowBalanceThreshold
    );

    expect(needsAttention).toBe(true);
  });
});

describe('Account Settings and an alert the user did not touch', () => {
  const renderSettings = (account: Account, table: AccountsTable) => {
    const service = refreshService(table);
    render(
      <AccountSettingsModal
        isOpen
        onClose={() => {}}
        account={account}
        onSave={(id: string, updates: AccountUpdate) => service.updateAccount(id, updates, USER_ID)}
      />
    );
  };

  it('shows the alert as ON for an account that has one', async () => {
    const table = createAccountsTable();
    const [account] = await bootService(table).getAccounts(USER_ID);

    renderSettings(account, table);

    // The form seeds this toggle from account.lowBalanceAlertEnabled. An
    // account loaded at boot used to arrive without that field, so the user
    // was shown "off" for an alert that was on.
    expect(screen.getByRole('switch', { name: 'Low Balance Alert' })).toBeChecked();
  });

  it('does not switch the alert off when the user saves an unrelated edit', async () => {
    const table = createAccountsTable();
    const [account] = await bootService(table).getAccounts(USER_ID);

    renderSettings(account, table);

    fireEvent.change(screen.getByLabelText('Account name'), {
      target: { value: 'Everyday Current — joint' }
    });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(table.writes).toHaveLength(1));

    // The headline: renaming an account cost the user their alert, because the
    // modal writes back the toggle it was seeded with and boot had seeded it
    // from a field it never mapped.
    expect(table.writes[0].low_balance_alert_enabled).not.toBe(false);
    expect(table.stored().low_balance_alert_enabled).toBe(true);
    expect(table.stored().low_balance_threshold).toBe(250);
    expect(table.stored().name).toBe('Everyday Current — joint');
  });

  it('still turns the alert off when the user actually turns it off', async () => {
    const table = createAccountsTable();
    const [account] = await bootService(table).getAccounts(USER_ID);

    renderSettings(account, table);

    fireEvent.click(screen.getByRole('switch', { name: 'Low Balance Alert' }));
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(table.writes).toHaveLength(1));
    expect(table.stored().low_balance_alert_enabled).toBe(false);
  });
});

describe('matching a statement to the account it came from', () => {
  const statement = {
    accountId: '87654321',
    bankId: '112233',
    isCreditCardStatement: false
  };

  it('finds the account after a refresh, not just at boot', async () => {
    const table = createAccountsTable();

    const bootAccounts = await bootService(table).getAccounts(USER_ID);
    const refreshedAccounts = await refreshService(table).getAccounts(USER_ID);

    // findAccountByOfxIdentifiers reads sortCode/accountNumber. The refresh
    // mapper carried the row's snake_case columns but produced neither, so an
    // import that matched before a sync stopped matching after one.
    expect(findAccountByOfxIdentifiers(statement, bootAccounts)?.id).toBe(ACCOUNT_ID);
    expect(findAccountByOfxIdentifiers(statement, refreshedAccounts)?.id).toBe(ACCOUNT_ID);
  });

  it('finds it again on the account handed back by a save', async () => {
    const table = createAccountsTable();
    const saved = await refreshService(table).updateAccount(
      ACCOUNT_ID,
      { name: 'Everyday Current' },
      USER_ID
    );

    // That account goes straight into app state (AppContextSupabase's
    // updateAccount replaces the row it holds), so a blind one there is blind
    // for the rest of the session.
    expect(findAccountByOfxIdentifiers(statement, [saved])?.id).toBe(ACCOUNT_ID);
  });
});

describe('rows the schema allows but no form creates', () => {
  it('keeps a cash account a cash account', async () => {
    const table = createAccountsTable({ ...accountRow(), type: 'cash' });
    const [account] = await bootService(table).getAccounts(USER_ID);

    // 'cash' is in the accounts_type_check constraint. Refiling it as
    // something else here would change the stored type the next time the user
    // saved anything on that account.
    expect(account.type).toBe('cash');
  });

  it('does not invent a bank balance for a row that has none', async () => {
    const table = createAccountsTable({
      ...accountRow(),
      bank_balance: null,
      bank_balance_date: null,
      low_balance_alert_enabled: false,
      low_balance_threshold: null
    });
    const [account] = await bootService(table).getAccounts(USER_ID);

    expect(account.bankBalance).toBeNull();
    expect(account.bankBalanceDate).toBeNull();
    expect(account.lowBalanceAlertEnabled).toBe(false);
    expect(account.lowBalanceThreshold).toBeUndefined();
  });
});
