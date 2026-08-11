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
 * ── THE PORT IS DELIBERATELY PARTIAL, AND SAYS SO ───────────────────────────
 *
 * `LocalDataPort` implements the reads, the boot composite, the capability
 * descriptor, the two lifecycle no-ops and the sixteen writes the crate's verbs
 * serve — and NOT the twenty-five operations that are named one by one in
 * `contract.ts`'s NOT_YET ratchet. The surface rule asserts that the operations
 * this port is missing are EXACTLY that list, in both directions, and every
 * rule needing one of them is skipped by name.
 *
 * So the `DataPort` annotation below is documentation rather than proof, which
 * is the situation `contract.ts` describes in its own words: tests are not
 * compiled by `tsc -b`, so the annotation is checked by nobody, and the runtime
 * list is what holds the port to the seam. **Do not "fix" it with a cast.** A
 * cast would silence the one honest signal that this engine is half-built, and
 * the thing that actually proves the surface is a test that already runs.
 */

import { afterAll } from 'vitest';
import { createSpawnTransport } from '../../local/coreTransport';
import { LocalDataPort } from '../../local/localDataPort';
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
