/**
 * The settings a ledger file carries, against the REAL crate and REAL files.
 *
 * @vitest-environment node
 *
 * Slice 28's claim, end to end: *a file that holds somebody's money holds the
 * choices they made about how to read it, and both travel in one backup.* Every
 * layer of that claim is proved somewhere else and none of those places can
 * prove it whole —
 *
 *   `crates/wealth-core/tests/preferences.rs`   the two verbs, against a file;
 *   `verb-specs/preferences-*`                  the two verbs, against the cloud's
 *                                               own writer;
 *   `local/__tests__/preferencesTransport.test.ts`  the translation, against a double.
 *
 * — because the interesting failures are in the SEAMS between them: a document
 * that does not survive the file being closed, a preference holding account ids
 * that comes back pointing at the accounts of the ledger it was exported FROM,
 * a second login's settings bleeding into a file that holds two.
 *
 * Every call here is a separate `wealth-core-cli` PROCESS, so "written" and
 * "committed and readable by something else" are the same assertion whether the
 * test says so or not — which is exactly the property a document in memory would
 * have failed.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  RESTORE_STEPS,
  buildBackupBundle,
  remapBackupIds,
  rowsForStep
} from '../../backup/format';
import { LocalDataPort, type BackupFormat } from '../../local/localDataPort';
import { localPreferencesTransport } from '../../local/preferencesTransport';
import { createSpawnTransport } from '../../local/spawnTransport';
import type { PreferencesDocument } from '../../preferences/document';
import type { PortFixture } from './contract';
import { LedgerFiles, locateBridge, seed } from './localCore.fixtureFile';

const OWNER = '11111111-1111-1111-1111-111111111111';
const STRANGER = '22222222-2222-2222-2222-222222222222';
const EVERYDAY = 'a0000000-0000-0000-0000-000000000001';
const RAINY_DAY = 'a0000000-0000-0000-0000-000000000002';

const bridge = locateBridge();
const files = new LedgerFiles(bridge);

afterAll(() => {
  files.dispose();
});

/** Two accounts, so that a preference naming one has something to name. */
const fixture = (): PortFixture => ({
  accounts: [
    {
      id: EVERYDAY,
      name: 'Everyday',
      type: 'current',
      balance: 0,
      currency: 'GBP',
      institution: '',
      isActive: true,
      openingBalance: 0,
      lastUpdated: new Date('2026-01-01T00:00:00.000Z')
    },
    {
      id: RAINY_DAY,
      name: 'Rainy day',
      type: 'savings',
      balance: 0,
      currency: 'GBP',
      institution: '',
      isActive: true,
      openingBalance: 0,
      lastUpdated: new Date('2026-01-01T00:00:00.000Z')
    }
  ],
  categories: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Transfer',
      type: 'both',
      level: 'type',
      parentId: null,
      isActive: true
    }
  ]
});

/**
 * The REAL format, with a counting id generator.
 *
 * The contract suite's reasoning, verbatim: `remapBackupIds`'s own default is
 * `crypto.randomUUID`, and a random id would make two exports of one ledger
 * differ in every id while being the same ledger. Uuid-SHAPED because these ids
 * land in a file and the remapper tells a reference from a label partly by
 * shape.
 */
const backupFormat = (): BackupFormat => {
  let sequence = 0;
  const mint = (): string =>
    `00000000-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;
  return {
    steps: RESTORE_STEPS,
    build: buildBackupBundle,
    rowsForStep,
    remapIds: bundle => remapBackupIds(bundle, mint)
  };
};

const portFor = (file: string): LocalDataPort =>
  new LocalDataPort({
    owner: OWNER,
    transport: createSpawnTransport({ binary: bridge, database: file }),
    format: backupFormat(),
    migration: {
      plan: () => {
        throw new Error('not this test');
      }
    },
    logger: {
      error: (message, error) => {
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

const settingsOf = (file: string, owner = OWNER): ReturnType<typeof localPreferencesTransport> =>
  localPreferencesTransport({
    owner,
    transport: createSpawnTransport({ binary: bridge, database: file })
  });

/** A second login in the same file — what a restored two-person backup leaves. */
const addStranger = (file: string): void => {
  const database = new DatabaseSync(file);
  try {
    database
      .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
      .run(STRANGER, 'stranger@example.test');
  } finally {
    database.close();
  }
};

/** The document a file holds for one login, read by an independent witness. */
const storedFor = (file: string, owner: string): unknown => {
  const database = new DatabaseSync(file);
  try {
    const row = database
      .prepare('SELECT prefs FROM user_preferences WHERE user_id = ?')
      .get(owner) as { prefs?: string } | undefined;
    return row === undefined ? null : JSON.parse(String(row.prefs));
  } finally {
    database.close();
  }
};

const aDocument = (values: Record<string, string>): PreferencesDocument => ({
  version: 1,
  values
});

describe('settings live in the ledger file', () => {
  it('survives the file being closed and opened again', async () => {
    // THE ROUND TRIP. Every call below is its own process, so the second read
    // cannot see anything the first did not commit.
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);
    const document = aDocument({ money_management_theme: 'dark', accountsSortMode: 'balance' });

    await settingsOf(file).write(OWNER, document);

    expect(await settingsOf(file).read(OWNER)).toEqual(document);
    expect(storedFor(file, OWNER)).toEqual(document);
  });

  it('says nothing rather than nothing-in-particular for a fresh ledger', async () => {
    // `null`, not `{ values: {} }`. A brand-new file has never been told
    // anything, and `attach` reads that as its cue to lift whatever this machine
    // already holds.
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);

    expect(await settingsOf(file).read(OWNER)).toBeNull();
  });

  it('replaces the document, so a setting turned off stays off', async () => {
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);

    await settingsOf(file).write(OWNER, aDocument({ keep: 'yes', drop: 'yes' }));
    await settingsOf(file).write(OWNER, aDocument({ keep: 'yes' }));

    expect(await settingsOf(file).read(OWNER)).toEqual(aDocument({ keep: 'yes' }));
  });

  it('keeps two logins in one file apart, in both directions', async () => {
    // A file really can hold two: a backup restored from an account that had
    // them leaves both sets of rows, and there is no RLS here to narrow an
    // answer afterwards.
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);
    addStranger(file);

    await settingsOf(file).write(OWNER, aDocument({ who: 'mine' }));
    await settingsOf(file, STRANGER).write(STRANGER, aDocument({ who: 'theirs' }));

    expect(await settingsOf(file).read(OWNER)).toEqual(aDocument({ who: 'mine' }));
    expect(await settingsOf(file, STRANGER).read(STRANGER)).toEqual(aDocument({ who: 'theirs' }));
    expect(storedFor(file, OWNER)).toEqual(aDocument({ who: 'mine' }));
    expect(storedFor(file, STRANGER)).toEqual(aDocument({ who: 'theirs' }));
  });

  it('refuses to touch this file in another login’s name, before it sends anything', async () => {
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);
    addStranger(file);
    await settingsOf(file, STRANGER).write(STRANGER, aDocument({ who: 'theirs' }));

    await expect(settingsOf(file).write(STRANGER, aDocument({ who: 'stolen' }))).rejects.toThrow(
      /this ledger is 11111111/
    );

    // And the stranger's document is exactly as it was.
    expect(storedFor(file, STRANGER)).toEqual(aDocument({ who: 'theirs' }));
  });
});

describe('settings travel in the backup', () => {
  it('exports the document the file holds', async () => {
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);
    const document = aDocument({ money_management_currency: 'GBP' });
    await settingsOf(file).write(OWNER, document);

    const bundle = await portFor(file).collectBackup();

    expect(bundle.preferences).toEqual(document);
  });

  it('exports null when the file holds none, so a restore reports no loss', async () => {
    const file = files.create('prefs');
    seed(file, fixture(), OWNER);

    const bundle = await portFor(file).collectBackup();

    expect(bundle.preferences).toBeNull();
  });

  it('pours the settings back into another ledger, and says how many', async () => {
    const source = files.create('prefs-source');
    seed(source, fixture(), OWNER);
    await settingsOf(source).write(
      OWNER,
      aDocument({ money_management_theme: 'dark', accountsSortMode: 'balance' })
    );
    const bundle = await portFor(source).collectBackup();

    const target = files.create('prefs-target');
    seed(target, fixture(), OWNER);
    // A restore REPLACES, and refuses a store that still holds anything.
    await portFor(target).wipeAllFinancialData();
    const outcome = await portFor(target).restoreBackup(bundle);

    expect(outcome.preferencesRestored).toBe(2);
    expect(outcome.preferencesFailure).toBeNull();
    expect(await settingsOf(target).read(OWNER)).toEqual(
      aDocument({ money_management_theme: 'dark', accountsSortMode: 'balance' })
    );
  });

  it('follows the account ids inside a preference to the accounts they became', async () => {
    // THE FAILURE THAT IS OTHERWISE SILENT. `dashboardKeyAccounts` is a JSON
    // array of account ids, and a restore mints a fresh id for every row it puts
    // back. Restored verbatim, the dashboard's key accounts would be accounts
    // that no longer exist — the page would simply be empty, and nothing would
    // say why. `remapBackupIds` follows them, and this is the whole chain that
    // proves it: a real export, a real remap, a real file.
    const source = files.create('prefs-source');
    seed(source, fixture(), OWNER);
    await settingsOf(source).write(
      OWNER,
      aDocument({ dashboardKeyAccounts: JSON.stringify([EVERYDAY, RAINY_DAY]) })
    );
    const bundle = await portFor(source).collectBackup();

    const target = files.create('prefs-target');
    seed(target, fixture(), OWNER);
    await portFor(target).wipeAllFinancialData();
    await portFor(target).restoreBackup(bundle);

    const restored = await settingsOf(target).read(OWNER);
    const pinned: unknown = JSON.parse(String(restored?.values.dashboardKeyAccounts));
    const accounts = await portFor(target).listAccounts();

    // Not the ids that went in …
    expect(pinned).not.toEqual([EVERYDAY, RAINY_DAY]);
    // … and every one of them is an account this ledger really has.
    expect(new Set(pinned as string[])).toEqual(new Set(accounts.map(account => account.id)));
  });

  it('reports a settings failure instead of losing the ledger to it', async () => {
    // B-10 makes a local restore ONE transaction, so a document the file refuses
    // — over the 256 KiB ceiling here — would take every account, transaction,
    // budget and goal down with it if the settings were written inside it. They
    // are written after, and the failure is a sentence.
    const source = files.create('prefs-source');
    seed(source, fixture(), OWNER);
    const bundle = await portFor(source).collectBackup();
    const enormous: PreferencesDocument = aDocument({ vast: 'x'.repeat(300_000) });

    const target = files.create('prefs-target');
    seed(target, fixture(), OWNER);
    await portFor(target).wipeAllFinancialData();
    const port = new LocalDataPort({
      owner: OWNER,
      transport: createSpawnTransport({ binary: bridge, database: target }),
      format: backupFormat(),
      migration: {
        plan: () => {
          throw new Error('not this test');
        }
      },
      // Expected here, so recorded rather than shouted.
      logger: { error: () => {} }
    });

    const outcome = await port.restoreBackup({ ...bundle, preferences: enormous });

    expect(outcome.preferencesRestored).toBe(0);
    expect(outcome.preferencesFailure).toMatch(/user_preferences_prefs_is_small/);
    // The ledger is all the way in, which is the point.
    expect((await port.listAccounts()).map(account => account.name).sort()).toEqual([
      'Everyday',
      'Rainy day'
    ]);
  });
});
