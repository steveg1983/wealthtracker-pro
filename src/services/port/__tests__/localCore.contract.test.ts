/**
 * The contract suite, run against the LOCAL edition — a real `.db` file, driven
 * through the real ledger crate.
 *
 * @vitest-environment node
 *
 * The promise `contract.ts` made when it was written is cashed here: *"the
 * local edition can add twenty lines like the ones below and inherit every
 * rule"*. It turned out to be four hundred rather than twenty, and all four
 * hundred are in `localCore.fixtureFile.ts` — the translation between the app's
 * shapes and a SQLite ledger's, which is real work and was worth finding out
 * about. What is here is the wiring, and it is short, which is the part the
 * promise was actually about.
 *
 * ── IT RUNS AGAINST THE CRATE, OR IT FAILS ──────────────────────────────────
 *
 * No `describe.skipIf`, no silent pass when the binary is not built (R-8). A
 * suite that goes quiet on a machine without a Rust toolchain would report the
 * local edition as conforming on every machine that has not built it, which is
 * most of them — including, one day, the one that ships it. It is excluded from
 * `npm run test:smoke` by path instead, and has a script of its own,
 * `npm run test:local-contract`, so the two questions ("does the app work" and
 * "does the local engine keep the seam's contract") stay separable.
 *
 * ── THE PORT IS WHOLE, AND THE RATCHET THAT SAID OTHERWISE IS GONE ──────────
 *
 * `LocalDataPort` answers every operation the seam names. It did not always:
 * from slice 18 to slice 25 it was a partial port, and `contract.ts` carried a
 * NOT_YET ratchet naming what was missing — checked in both directions, counted,
 * monotone-shrinking, with every rule that needed a missing operation skipped BY
 * NAME so a run read as a work queue. Slice 26 wired the last one
 * (`importMsMoney`, which is a wipe and a restore and needed no new rule), the
 * count reached zero, and the ratchet was DELETED rather than left holding an
 * empty array. Every rule in the suite now runs on this engine; none is skipped.
 *
 * The `DataPort` annotation below is still documentation rather than proof —
 * tests are not compiled by `tsc -b` — but `localDataPort.ts` IS compiled, and
 * the class there says `implements DataPort`, so the surface is now proved twice:
 * once by the compiler on the production module, and once at runtime by the
 * surface rule, which walks `DATA_PORT_OPERATIONS` against the object a harness
 * really built. **Do not "fix" the annotation with a cast**, here or anywhere:
 * the two proofs are independent on purpose, and a cast would remove the one
 * that watches what the harness assembles.
 */

import { afterAll } from 'vitest';
import {
  RESTORE_STEPS,
  buildBackupBundle,
  remapBackupIds,
  rowsForStep
} from '../../backupService';
import { planCloudImport } from '../../import/msMoney/msMoneyImport';
import { createSpawnTransport } from '../../local/coreTransport';
import {
  LocalDataPort,
  type BackupFormat,
  type MsMoneyMigration
} from '../../local/localDataPort';
import type { DataPort } from '../dataPort';
import { runDataPortContract, type DataPortUnderTest, type PortFixture } from './contract';
import { LedgerFiles, locateBridge, readBack, seed } from './localCore.fixtureFile';

/**
 * The file's one login.
 *
 * A uuid because `schema.sql` insists: `CHECK (id = lower(id) AND length(id) =
 * 36)` on `users`, which is why `LOCAL_SOURCE_USER_ID` ('local-device') cannot
 * be a file's owner and stays what it already is — a provenance string in the
 * browser bundle (PHASE3-PLAN D-5, R-3).
 *
 * The harness states it because the harness is what opens a document at this
 * slice. When the desktop shell exists, `create_file` mints it and `open_file`
 * reads it back, and this constant becomes the shell's business rather than a
 * test's.
 */
const OWNER = '11111111-1111-1111-1111-111111111111';

const bridge = locateBridge();
const files = new LedgerFiles(bridge);

/**
 * The backup FILE FORMAT, supplied to the port the way the desktop shell will
 * supply it.
 *
 * These are the REAL functions the cloud export and the browser export call —
 * not stand-ins — which is the whole point: B-11 says one format is read by
 * every edition, and a harness that handed the port its own builder would prove
 * only that the local engine agrees with a builder written for the test.
 *
 * They are imported HERE rather than by the port because `backupService.ts`
 * carries a Supabase client at module scope and a desktop bundle may not. A test
 * is not a bundle; see `localDataPort.ts`'s `BackupFormat` for the obligation
 * that leaves for slice 27.
 *
 * ── THE ONE THING THAT IS NOT PRODUCTION'S: THE ID GENERATOR ────────────────
 *
 * `remapBackupIds` mints one id per row and its own default is
 * `crypto.randomUUID`, which is what the app resolves to. A fresh COUNTER per
 * store is supplied instead, exactly as the browser-storage harness supplies
 * `uuid: () => \`generated-${++sequence}\``, and for the same reason: the rule
 * *"a restored ledger exports to the same file again, and again"* compares
 * generation 2 against generation 3, and random ids would make those two files
 * differ in every id while being the same ledger — a failure that says nothing
 * about the conversion the rule is actually about.
 *
 * Shaped like a uuid rather than like `generated-3`, because these ids land in
 * a FILE: `remapBackupIds` tells a reference from a label inside TEXT columns
 * partly by shape, and a ledger whose ids do not look like ids is not the
 * dataset anybody restores.
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

/**
 * How a parsed .mny file becomes rows, supplied the way the desktop shell will
 * supply it.
 *
 * `planCloudImport` is the REAL planner the cloud migration runs, for the same
 * reason the four format functions above are the real ones: it is where Money's
 * model is reconciled with the app's, and a harness that handed the port its own
 * planner would prove only that the local engine agrees with a planner written
 * for the test. It is imported HERE rather than by the port because its module
 * reaches `storageAdapter` and the app's cloud-bound logger, neither of which
 * belongs in a desktop bundle — see `MsMoneyMigration` for the obligation that
 * leaves for slice 27.
 *
 * The generator is a COUNTER for the reason the format's is: the ids a plan
 * mints never reach the file (the restore remaps every one of them), but a
 * random one here would still make a failure message different on every run for
 * no reason. Uuid-SHAPED because `remapBackupIds` tells a reference from a label
 * inside TEXT columns partly by shape, and `ffffffff` rather than the format's
 * `00000000` so that a plan id and a stored id can never be read for one another
 * in a diff.
 */
const msMoneyMigration = (): MsMoneyMigration => {
  let sequence = 0;
  const mint = (): string =>
    `ffffffff-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;
  return { plan: (result, owner) => planCloudImport(result, owner, mint) };
};

afterAll(() => {
  files.dispose();
});

/**
 * A fresh ledger, seeded, with a port pointed at it.
 *
 * A FILE PER TEST, never one reset between them: two of the contract's rules
 * build two stores on purpose and ask each whether it can see the other's rows,
 * which is the cheapest way to catch a port that resolved the wrong owner.
 */
const createLocalCorePort = async (fixture: PortFixture): Promise<DataPortUnderTest> => {
  const file = files.create('ledger');
  seed(file, fixture, OWNER);

  const port: DataPort = new LocalDataPort({
    owner: OWNER,
    transport: createSpawnTransport({ binary: bridge, database: file }),
    format: backupFormat(),
    migration: msMoneyMigration(),
    // A LOUD logger, and deliberately not a silent one. Everything that reaches
    // it here is a read that could not happen against a file this harness has
    // just created and seeded — which is a broken harness, not an engine
    // behaviour, and it would otherwise show up as an empty ledger that several
    // assertions are perfectly happy with. The rules that ask what a broken
    // store costs use `createUnreadable` below, which expects the failure and
    // records it instead.
    logger: {
      error: (message, error) => {
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  return { port, read: async () => readBack(file) };
};

/**
 * A port whose file is not there.
 *
 * `db::open` uses `SQLITE_OPEN_READ_WRITE` without `CREATE`, so a path in a
 * directory that does not exist is a storage FAULT rather than a new empty
 * ledger: the crate's `respond` shows it out by the non-zero-exit door, the
 * spawn transport turns that into a rejection, and the three reads that may
 * never reject have to absorb it. That is the only way to ask them the
 * question — a store that always works never does.
 */
const createUnreadableLocalCorePort = async (): Promise<DataPort> => {
  const port: DataPort = new LocalDataPort({
    owner: OWNER,
    transport: createSpawnTransport({ binary: bridge, database: files.missing() }),
    format: backupFormat(),
    migration: msMoneyMigration(),
    // Expected here, so recorded rather than shouted: these tests exist to
    // prove the failure is survived, and a stack trace per assertion would bury
    // the run's real output.
    logger: { error: () => {} }
  });
  return port;
};

runDataPortContract('DataPort contract — local core', {
  engine: 'local-core',
  create: createLocalCorePort,
  createUnreadable: createUnreadableLocalCorePort
});
