/**
 * Restoring a password-protected backup.
 *
 * The dialog's own rule is that nothing wipes implicitly and every refusal says
 * what is wrong. An encrypted file tests both: it is a perfectly good backup
 * that cannot be read yet, and calling that "this file cannot be restored"
 * would send someone off to look for another copy of a file that is fine.
 *
 * The encryption is a wrapper, not a second door — so the test that matters
 * most is the last one: an unlocked bundle must land in the same validation and
 * the same preflight a plain file goes through.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encryptBackupBundle } from '../../services/backup/encryption';
import { buildBackupBundle, type BackupBundle } from '../../services/backup/format';

const financialDataIsEmpty = vi.fn(async () => true);

vi.mock('@data', () => ({
  dataPort: {
    financialDataIsEmpty: () => financialDataIsEmpty(),
    restoreBackup: vi.fn(),
  },
}));

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    refreshAccountsAndTransactions: vi.fn(),
    refreshCategories: vi.fn(),
    // `cannotKeep` is not optional — the preflight memo calls .filter on it, so
    // omitting it throws AFTER the assertions pass, which is how it hid: green
    // tests and an unhandled error in the run summary.
    capabilities: {
      backupTarget: 'login',
      session: 'ready',
      edition: 'cloud',
      cannotKeep: [],
    },
  }),
}));

const { default: RestoreBackupModal } = await import('../RestoreBackupModal');

const PASSWORD = 'a good long password';

/**
 * Built by the app's OWN builder rather than hand-written here. A fixture that
 * merely looks like a bundle would sail past this suite and prove nothing about
 * whether a decrypted file survives the real validation — which is the single
 * claim these tests exist to make.
 */
function bundleFixture(): BackupBundle {
  return JSON.parse(JSON.stringify(buildBackupBundle({
    sourceUserId: 'u-1',
    exportedAt: '2026-08-15T09:30:00.000Z',
    data: {
      accounts: [{ id: 'acc-1', name: 'Everyday', balance: '1234.56' }],
    },
  }))) as BackupBundle;
}

/** A File whose `.text()` resolves, which jsdom's own File does not do here. */
function fileOf(contents: unknown, name: string): File {
  const file = new File([JSON.stringify(contents)], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () => JSON.stringify(contents),
  });
  return file;
}

async function pick(file: File): Promise<void> {
  const input = screen.getByLabelText(/backup file|choose|file/i, { selector: 'input[type="file"]' });
  await userEvent.upload(input, file);
}

describe('Restore — a password-protected backup', () => {
  beforeEach(() => {
    financialDataIsEmpty.mockClear();
    financialDataIsEmpty.mockResolvedValue(true);
  });

  it('asks for the password instead of calling the file unreadable', async () => {
    const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
    await pick(fileOf(envelope, 'backup-encrypted.json'));

    await waitFor(() => {
      expect(screen.getByText(/password-protected/i)).toBeInTheDocument();
    });

    // The claim that would send someone looking for another copy.
    expect(screen.queryByText(/cannot be restored/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('names the date before asking, so three files can be told apart', async () => {
    const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
    await pick(fileOf(envelope, 'backup-encrypted.json'));

    await waitFor(() => {
      expect(screen.getByText(/15 August 2026/)).toBeInTheDocument();
    });
  });

  it('refuses a wrong password and stays on the same step', async () => {
    const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
    await pick(fileOf(envelope, 'backup-encrypted.json'));

    await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password');
    await userEvent.click(screen.getByRole('button', { name: 'Open backup' }));

    await waitFor(() => {
      expect(screen.getByText(/did not open the file/i)).toBeInTheDocument();
    });
    // Still askable — a mistyped password must not cost the user the file.
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('opens with the right password and reaches the ordinary preflight', async () => {
    const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
    await pick(fileOf(envelope, 'backup-encrypted.json'));

    await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Open backup' }));

    // The preflight is the shared path: it ran, which means the decrypted
    // bundle went through validation and the emptiness check like any other.
    await waitFor(() => {
      expect(financialDataIsEmpty).toHaveBeenCalled();
    });
    expect(screen.queryByText(/password-protected/i)).not.toBeInTheDocument();
  });

  it('still reads a plain backup exactly as before', async () => {
    render(<RestoreBackupModal isOpen onClose={vi.fn()} />);
    await pick(fileOf(bundleFixture(), 'backup.json'));

    await waitFor(() => {
      expect(financialDataIsEmpty).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
});
