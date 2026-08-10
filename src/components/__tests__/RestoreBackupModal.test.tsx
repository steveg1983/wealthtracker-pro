/**
 * Restore from backup — the dialog.
 *
 * The most destructive screen in the app: it erases a login or a device and
 * pours a file in over the top, and it had no test at all. So every assertion
 * here was first written against the behaviour as it stood BEFORE the seam took
 * the emptiness check and the restore, and run green against it. Only the mocks
 * changed afterwards — from the two engines this file used to choose between,
 * to the one door it knocks on now. That is what makes the suite evidence that
 * the routing changed nothing the user can see.
 *
 * STILL THE PAGE'S OWN, and mocked as such: the wipe (it joins the seam with
 * slice 10) and the identity that decides whether the copy says "login" or
 * "device" (slice 11).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildBackupBundle, type BackupBundle } from '../../services/backupService';

const appValue = {
  refreshAccountsAndTransactions: vi.fn(async () => {}),
  refreshCategories: vi.fn(async () => {}),
  isUsingSupabase: false,
};

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => appValue,
}));

vi.mock('../../services/transactionCache', () => ({
  transactionCache: { clear: vi.fn(async () => {}) },
}));

const userIds = vi.hoisted(() => ({
  value: { clerkId: null as string | null, databaseId: null as string | null },
}));

vi.mock('../../services/api/dataService', () => ({
  DataService: { getUserIds: () => userIds.value },
}));

/** The wipe is still this page's fork between two engines — slice 10 routes it. */
const engines = vi.hoisted(() => ({
  cloudWipe: vi.fn(async () => ({ transactions: 3 })),
  localWipe: vi.fn(async () => ({ transactions: 3 })),
}));

vi.mock('../../services/backupService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/backupService')>();
  return { ...actual, wipeUserFinancialData: engines.cloudWipe };
});

vi.mock('../../services/localBackupService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/localBackupService')>();
  return { ...actual, wipeLocalFinancialData: engines.localWipe };
});

/** The seam. One door, whichever store is behind it. */
const seam = vi.hoisted(() => ({
  financialDataIsEmpty: vi.fn<() => Promise<boolean>>(),
  restoreBackup: vi.fn(),
}));

vi.mock('../../services/port', () => ({ dataPort: seam }));

import RestoreBackupModal from '../RestoreBackupModal';

const bundleWith = (over: Partial<Record<string, Record<string, unknown>[]>> = {}): BackupBundle =>
  buildBackupBundle({
    sourceUserId: 'source-login',
    exportedAt: '2026-03-04T10:00:00.000Z',
    data: {
      accounts: [{ id: 'acct-1', name: 'Everyday', type: 'current', balance: '10.00' }],
      categories: [{ id: 'cat-1', name: 'Food', level: 'detail', type: 'expense' }],
      transactions: [
        { id: 'txn-1', account_id: 'acct-1', amount: '-10.00', date: '2026-02-01', description: 'Shop' },
      ],
      ...over,
    },
    preferences: null,
  });

const outcome = {
  restored: [{ label: 'Accounts', rows: 1 }, { label: 'Transactions', rows: 1 }],
  notStoredLocally: [] as { label: string; rows: number; absence: string }[],
  accountsRelinked: 0,
  transactionsRelinked: 0,
  preferencesRestored: 0,
  preferencesFailure: null as string | null,
  danglingRefs: [] as { entity: string; field: string; value: string }[],
};

const emptinessChecks = (): number => seam.financialDataIsEmpty.mock.calls.length;
const restoreCalls = (): number => seam.restoreBackup.mock.calls.length;

const handOver = (bundle: BackupBundle, name = 'backup.json'): void => {
  const json = JSON.stringify(bundle);
  const file = new File([json], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => json });
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } });
};

const pickFile = async (bundle: BackupBundle, name = 'backup.json'): Promise<void> => {
  handOver(bundle, name);
  await waitFor(() => expect(emptinessChecks()).toBeGreaterThan(0));
};

describe('RestoreBackupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userIds.value = { clerkId: null, databaseId: null };
    appValue.isUsingSupabase = false;
    seam.financialDataIsEmpty.mockResolvedValue(true);
    seam.restoreBackup.mockResolvedValue({ ...outcome });
  });

  const open = (): void => {
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
  };

  describe('reading the file', () => {
    it('says what the file holds before anything is committed', async () => {
      open();
      await pickFile(bundleWith());

      expect(screen.getByText('backup.json')).toBeInTheDocument();
      expect(screen.getByText('2026-02-01 to 2026-02-01')).toBeInTheDocument();
    });

    it('refuses a file that is not valid JSON, and asks the store nothing', async () => {
      open();
      const file = new File(['not json'], 'broken.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => 'not json' });
      fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } });

      await screen.findByText(/is not valid JSON/i);
      expect(emptinessChecks()).toBe(0);
    });

    it('shows the reason when the emptiness check refuses, and does not offer to restore', async () => {
      seam.financialDataIsEmpty.mockRejectedValue(new Error('The store could not be opened'));
      open();
      handOver(bundleWith());

      await screen.findByText('The store could not be opened');
      expect(screen.getByRole('button', { name: /Restore this backup/i })).toBeDisabled();
    });
  });

  describe('the empty-target rule', () => {
    it('lets a backup straight in when the target is empty', async () => {
      open();
      await pickFile(bundleWith());

      expect(await screen.findByText(/is empty, so the backup can go straight in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore this backup/i })).toBeEnabled();
    });

    it('refuses to restore over data, and demands the phrase before erasing', async () => {
      seam.financialDataIsEmpty.mockResolvedValue(false);
      open();
      await pickFile(bundleWith());

      expect(await screen.findByText(/already holds data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore this backup/i })).toBeDisabled();

      const erase = screen.getByRole('button', { name: /Erase everything in this device/i });
      expect(erase).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Type DELETE EVERYTHING to confirm'), {
        target: { value: 'delete everything' },
      });
      expect(erase).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Type DELETE EVERYTHING to confirm'), {
        target: { value: 'DELETE EVERYTHING' },
      });
      expect(erase).toBeEnabled();
    });

    it('passes the typed phrase through untouched and re-checks emptiness after erasing', async () => {
      seam.financialDataIsEmpty.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      open();
      await pickFile(bundleWith());
      await screen.findByText(/already holds data/i);

      fireEvent.change(screen.getByLabelText('Type DELETE EVERYTHING to confirm'), {
        target: { value: 'DELETE EVERYTHING' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Erase everything in this device/i }));

      await waitFor(() => expect(engines.localWipe).toHaveBeenCalledWith('DELETE EVERYTHING'));
      expect(engines.cloudWipe).not.toHaveBeenCalled();
      await screen.findByText(/is empty, so the backup can go straight in/i);
      expect(emptinessChecks()).toBe(2);
    });
  });

  describe('restoring', () => {
    it('hands over the file it validated, and reports what came back', async () => {
      open();
      await pickFile(bundleWith());
      await screen.findByText(/is empty, so the backup can go straight in/i);
      fireEvent.click(screen.getByRole('button', { name: /Restore this backup/i }));

      await screen.findByText('Restore finished');
      expect(restoreCalls()).toBe(1);
      const [bundle, options] = seam.restoreBackup.mock.calls[0];
      expect(bundle.format).toBe('wealthtracker-backup-v2');
      expect(bundle.counts.transactions).toBe(1);
      expect(typeof options.onProgress).toBe('function');

      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(appValue.refreshAccountsAndTransactions).toHaveBeenCalled();
      expect(appValue.refreshCategories).toHaveBeenCalled();
    });

    it('names what this device could not keep instead of leaving it to be discovered', async () => {
      seam.restoreBackup.mockResolvedValue({
        ...outcome,
        notStoredLocally: [
          { label: 'Investments', rows: 3, absence: 'holdings are only tracked when you are signed in' },
        ],
      });
      open();
      await pickFile(bundleWith());
      await screen.findByText(/is empty, so the backup can go straight in/i);
      fireEvent.click(screen.getByRole('button', { name: /Restore this backup/i }));

      await screen.findByText('Restore finished');
      expect(screen.getByText(/This device does not hold investments/i)).toBeInTheDocument();
      expect(screen.getByText(/holdings are only tracked when you are signed in/i)).toBeInTheDocument();
    });

    it('says a device restore changed nothing at all when it fails', async () => {
      seam.restoreBackup.mockRejectedValue(new Error('restore_target_not_empty: this device already holds data'));
      open();
      await pickFile(bundleWith());
      await screen.findByText(/is empty, so the backup can go straight in/i);
      fireEvent.click(screen.getByRole('button', { name: /Restore this backup/i }));

      await screen.findByText(/Stopped at:/);
      expect(screen.getByText(/restore_target_not_empty/)).toBeInTheDocument();
      expect(screen.getByText(/Nothing on this device was changed/i)).toBeInTheDocument();
      expect(screen.queryByText(/partly populated/i)).not.toBeInTheDocument();
    });

    it('warns that a login is partly populated when a cloud restore fails halfway', async () => {
      userIds.value = { clerkId: 'clerk_1', databaseId: 'db-user-1' };
      seam.restoreBackup.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
      open();
      await pickFile(bundleWith());
      await screen.findByText(/is empty, so the backup can go straight in/i);
      fireEvent.click(screen.getByRole('button', { name: /Restore this backup/i }));

      await screen.findByText(/Stopped at:/);
      expect(screen.getByText(/partly populated/i)).toBeInTheDocument();
    });
  });

  describe('a session that has not resolved its login yet', () => {
    it('refuses the file rather than aiming a restore at the browser', async () => {
      appValue.isUsingSupabase = true;
      userIds.value = { clerkId: 'clerk_1', databaseId: null };
      open();
      handOver(bundleWith());

      await screen.findByText(/no database identity yet/i);
      expect(emptinessChecks()).toBe(0);
      expect(restoreCalls()).toBe(0);
    });
  });

  describe('what a device cannot keep, said before the user commits', () => {
    it('warns about the tables this device has nowhere to put', async () => {
      open();
      await pickFile(bundleWith({ investments: [{ id: 'inv-1', symbol: 'ABC' }] }));

      expect(await screen.findByText(/Part of this backup cannot be kept on this device/i)).toBeInTheDocument();
    });

    it('says nothing about them when the target is a login', async () => {
      userIds.value = { clerkId: 'clerk_1', databaseId: 'db-user-1' };
      open();
      await pickFile(bundleWith({ investments: [{ id: 'inv-1', symbol: 'ABC' }] }));

      await screen.findByText(/is empty, so the backup can go straight in/i);
      expect(screen.queryByText(/cannot be kept on this device/i)).not.toBeInTheDocument();
    });
  });
});
