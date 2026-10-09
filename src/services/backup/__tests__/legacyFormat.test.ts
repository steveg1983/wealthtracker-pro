/**
 * A backup written under the OLD format tag still restores.
 *
 * This is the regression test for a promise made to people holding files:
 * `wealthtracker-backup-v2` and `wealthtracker-encrypted-backup` were written
 * into every backup before the 2026 rename, and those files are on disks we
 * cannot reach. The writer may move to a new tag; the reader may never stop
 * accepting these two. The fixtures below spell the legacy tags out as
 * literals ON PURPOSE — if someone "tidies" them into the constant, the test
 * stops proving anything.
 */
import { describe, it, expect } from 'vitest';
import {
  ACCEPTED_BACKUP_FORMATS,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  LEGACY_BACKUP_FORMATS,
  validateBackupBundle,
} from '../format';
import {
  ACCEPTED_ENCRYPTED_BACKUP_FORMATS,
  ENCRYPTED_BACKUP_FORMAT,
  LEGACY_ENCRYPTED_BACKUP_FORMATS,
  isEncryptedBackup,
} from '../encryption';

const legacyPlainBundle = (format: string): unknown => ({
  format,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  exportedAt: '2026-08-07T12:00:00.000Z',
  source: { app: 'wealthtracker', userId: 'u-1' },
  counts: {},
  data: {
    accounts: [],
    categories: [],
    transactions: [],
    transaction_splits: [],
    budgets: [],
    goals: [],
    goal_contributions: [],
    investments: [],
    investment_transactions: [],
    recurring_transactions: [],
    notifications: [],
    dashboard_layouts: [],
    widget_preferences: [],
    suggestion_dismissals: [],
    custom_reports: [],
    forecast_adjustments: [],
  },
  links: { account_parents: [], transaction_links: [] },
  preferences: null,
});

describe('backup format tags survive the rename', () => {
  it('the current tag is accepted, and so is every legacy tag — as literals', () => {
    expect(ACCEPTED_BACKUP_FORMATS.has(BACKUP_FORMAT)).toBe(true);
    expect(ACCEPTED_BACKUP_FORMATS.has('wealthtracker-backup-v2')).toBe(true);
    expect(LEGACY_BACKUP_FORMATS).toContain('wealthtracker-backup-v2');
  });

  it('a plain backup carrying the legacy tag validates', () => {
    const result = validateBackupBundle(legacyPlainBundle('wealthtracker-backup-v2'));
    expect(result.ok).toBe(true);
  });

  it('an unknown tag is still refused, naming what was expected', () => {
    const result = validateBackupBundle(legacyPlainBundle('somebody-elses-backup-v9'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain(BACKUP_FORMAT);
      expect(result.problem).toContain('somebody-elses-backup-v9');
    }
  });

  it('an encrypted envelope carrying the legacy tag is recognised', () => {
    expect(ACCEPTED_ENCRYPTED_BACKUP_FORMATS.has(ENCRYPTED_BACKUP_FORMAT)).toBe(true);
    expect(LEGACY_ENCRYPTED_BACKUP_FORMATS).toContain('wealthtracker-encrypted-backup');
    expect(
      isEncryptedBackup({
        format: 'wealthtracker-encrypted-backup',
        version: 1,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'c2FsdA==' },
        cipher: { name: 'AES-GCM', iv: 'aXY=' },
        ciphertext: 'Y2lwaGVy',
      })
    ).toBe(true);
    expect(isEncryptedBackup({ format: 'not-ours', ciphertext: 'x', kdf: { salt: 's', iterations: 1 }, cipher: { iv: 'i' } })).toBe(false);
  });
});
