/**
 * Restore from backup — the dialog.
 *
 * The most destructive screen in the app: it erases a login or a device and
 * pours a file in over the top, and it had no test at all. So every assertion
 * here was first written against the behaviour as it stood BEFORE the seam took
 * the emptiness check, the restore and the wipe, and run green against it. Only
 * the mocks changed afterwards — from the engines this file used to choose
 * between, to the one door it knocks on now. That is what makes the suite
 * evidence that the routing changed nothing the user can see.
 *
 * STILL THE PAGE'S OWN, and mocked as such: the two CAPABILITIES that decide
 * whether the copy says "login" or "device", whether a failure can have left a
 * half-filled target, and whether the target is nameable at all. It used to
 * read a database id off DataService to answer those three — the app's last
 * consumer of `getUserIds`, and a screen holding somebody's identity in order
 * to choose a word. No data operation on this screen picks an engine any more,
 * and now no part of it knows who is signed in.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildBackupBundle, type BackupBundle } from '../../services/backupService';
import type { DataPortCapabilities } from '../../services/port';

/** A device with nobody signed in — this suite's default target. */
const DEVICE: DataPortCapabilities = {
  edition: 'device',
  session: 'anonymous',
  realtime: false,
  maxConcurrentWrites: 1,
  backupTarget: 'device',
};

/** A resolved login: chunked restore, so a failure can leave it partly full. */
const LOGIN: DataPortCapabilities = {
  edition: 'cloud',
  session: 'ready',
  realtime: true,
  maxConcurrentWrites: 8,
  backupTarget: 'login',
};

/**
 * Signing in, but not there yet. The state with the data loss behind it: the
 * store is NOT a device, and a restore started here would pour the file into
 * browser storage the signed-in app will never read again.
 */
const CONNECTING: DataPortCapabilities = {
  edition: 'device',
  session: 'connecting',
  realtime: false,
  maxConcurrentWrites: 1,
  backupTarget: 'device',
};

const appValue = {
  refreshAccountsAndTransactions: vi.fn(async () => {}),
  refreshCategories: vi.fn(async () => {}),
  capabilities: DEVICE,
};

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => appValue,
}));

vi.mock('../../services/transactionCache', () => ({
  transactionCache: { clear: vi.fn(async () => {}) },
}));

/** The seam. One door, whichever store is behind it. */
const seam = vi.hoisted(() => ({
  financialDataIsEmpty: vi.fn<() => Promise<boolean>>(),
  restoreBackup: vi.fn(),
  wipeAllFinancialData: vi.fn<() => Promise<void>>(),
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
    appValue.capabilities = DEVICE;
    seam.financialDataIsEmpty.mockResolvedValue(true);
    seam.restoreBackup.mockResolvedValue({ ...outcome });
    seam.wipeAllFinancialData.mockResolvedValue(undefined);
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

    it('erases through the one door, and re-checks emptiness afterwards', async () => {
      // The phrase gates the BUTTON (above) and is not carried any further: the
      // seam supplies whatever its own store demands, which is what stopped this
      // file from having to know there is more than one. What is asserted here
      // is that erasing happens exactly once, without an owner, and that the
      // dialog then asks the store again rather than assuming it worked.
      seam.financialDataIsEmpty.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      open();
      await pickFile(bundleWith());
      await screen.findByText(/already holds data/i);

      fireEvent.change(screen.getByLabelText('Type DELETE EVERYTHING to confirm'), {
        target: { value: 'DELETE EVERYTHING' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Erase everything in this device/i }));

      await waitFor(() => expect(seam.wipeAllFinancialData).toHaveBeenCalledTimes(1));
      expect(seam.wipeAllFinancialData).toHaveBeenCalledWith();
      await screen.findByText(/is empty, so the backup can go straight in/i);
      expect(emptinessChecks()).toBe(2);
    });

    it('keeps the store’s own sentence when erasing fails, and does not go on', async () => {
      // A wipe that stopped is the one moment this dialog must not carry on:
      // the restore behind it only ever writes into an empty store, and a
      // half-erased one is neither empty nor untouched.
      seam.financialDataIsEmpty.mockResolvedValueOnce(false);
      seam.wipeAllFinancialData.mockRejectedValueOnce(
        new Error('canceling statement due to statement timeout')
      );
      open();
      await pickFile(bundleWith());
      await screen.findByText(/already holds data/i);

      fireEvent.change(screen.getByLabelText('Type DELETE EVERYTHING to confirm'), {
        target: { value: 'DELETE EVERYTHING' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Erase everything in this device/i }));

      await screen.findByText(/Stopped at:/);
      expect(screen.getByText('canceling statement due to statement timeout')).toBeInTheDocument();
      expect(restoreCalls()).toBe(0);
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
      appValue.capabilities = LOGIN;
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
      appValue.capabilities = CONNECTING;
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
      appValue.capabilities = LOGIN;
      open();
      await pickFile(bundleWith({ investments: [{ id: 'inv-1', symbol: 'ABC' }] }));

      await screen.findByText(/is empty, so the backup can go straight in/i);
      expect(screen.queryByText(/cannot be kept on this device/i)).not.toBeInTheDocument();
    });
  });
});
