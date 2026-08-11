/**
 * The desktop's document: what it is assembled from, and the ORDER it boots in.
 *
 * Both questions are about wiring rather than about a ledger, so neither needs a
 * file or a Rust toolchain — the real engine is proved by the contract suite.
 * What is here is the half a contract cannot state: the seam requires categories
 * to be resolved before any transaction or budget read, and on this engine that
 * ordering is kept by the CALL SITE rather than inside a verb.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  bootDeviceLedger,
  deviceBackupFormat,
  deviceMsMoneyMigration,
  openDeviceDocument
} from '../deviceDocument';
import { RESTORE_STEPS, buildBackupBundle, rowsForStep } from '../../backup/format';

const OWNER = '11111111-1111-1111-1111-111111111111';

/**
 * A parsed .mny file with nothing in it. The transform's four collections, in
 * the names `planCloudImport` reads them by — spelled out rather than cast from
 * `{}`, because a planner handed a shape it did not expect is exactly the
 * failure a migration must never have.
 */
const EMPTY_MNY = {
  accounts: [],
  categories: [],
  transactions: [],
  transactionSplits: []
};
const LEDGER = { path: '/Users/somebody/My money.db', owner: OWNER };

/** Six empty lists — what a brand-new file legitimately answers a boot with. */
const EMPTY_BOOT = {
  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  goals: [],
  splits: [],
  dismissals: []
};

/** A shell that answers every verb, and remembers the order it was asked. */
const shellRecording = (): {
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
  verbs: string[];
} => {
  const verbs: string[] = [];
  return {
    verbs,
    invoke: async (_command, args) => {
      const verb = String(args.verb);
      verbs.push(verb);
      if (verb === 'seed_categories') return { ok: true, result: { answer: { categories: [] } } };
      if (verb === 'load_boot') return { ok: true, result: { answer: EMPTY_BOOT } };
      return { ok: true, result: { answer: {} } };
    }
  };
};

describe('the device boot', () => {
  it('resolves categories BEFORE it reads the ledger', async () => {
    // `localDataPort.ts` states the obligation this test holds: *"The device
    // boot slice 27 writes must `await port.prepareCategories()` before
    // `port.loadBoot()`."* The cloud keeps the same ordering inside its own
    // loadBoot; a file cannot, because its load_boot is one crossing of one
    // transaction and seeding is a deliberate act rather than a side effect of
    // looking at a file.
    const shell = shellRecording();
    const port = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });

    await bootDeviceLedger(port);

    expect(shell.verbs).toEqual(['seed_categories', 'load_boot']);
  });

  it('waits for the seed rather than starting both at once', async () => {
    // The failure this prevents is silent and only happens on a FIRST launch:
    // a register drawn against categories that do not exist yet. Two calls
    // issued together would pass a test that only checked the order they were
    // started in, so the seed is made slow and the boot must still be second.
    const started: string[] = [];
    const finished: string[] = [];
    const invoke = async (_command: string, args: Record<string, unknown>): Promise<unknown> => {
      const verb = String(args.verb);
      started.push(verb);
      if (verb === 'seed_categories') {
        await new Promise(resolve => setTimeout(resolve, 5));
        finished.push(verb);
        return { ok: true, result: { answer: { categories: [] } } };
      }
      finished.push(verb);
      return { ok: true, result: { answer: EMPTY_BOOT } };
    };

    await bootDeviceLedger(openDeviceDocument({ ledger: LEDGER, invoke }));

    expect(started).toEqual(['seed_categories', 'load_boot']);
    expect(finished).toEqual(['seed_categories', 'load_boot']);
  });

  it('hands back the boot the file answered with', async () => {
    const shell = shellRecording();

    const boot = await bootDeviceLedger(openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }));

    expect(boot.accounts).toEqual([]);
    expect(boot.transactions).toEqual([]);
  });

  it('does not swallow a boot that could not happen', async () => {
    // The three reads that may never reject are the port's business and are
    // proved there. `prepareCategories` is NOT one of them: a seed that failed
    // means the file could not be written to, and a window that carried on
    // would file every new row against categories it never made.
    const invoke = async (): Promise<unknown> => {
      throw 'no ledger is open in this window, so there was nothing to ask';
    };

    await expect(
      bootDeviceLedger(openDeviceDocument({ ledger: LEDGER, invoke }))
    ).rejects.toThrow(/could not answer seed_categories/);
  });
});

describe('what a device document is assembled from', () => {
  it('constructs the port with the owner the FILE stated', async () => {
    // D-5: the port is constructed with the open document's owner and caches it
    // for the document's life. Every verb it sends carries that id, and there is
    // nowhere to pass a different one.
    const shell = {
      asked: [] as Record<string, unknown>[],
      invoke: async (_command: string, args: Record<string, unknown>): Promise<unknown> => {
        shell.asked.push(args);
        return { ok: true, result: { answer: { accounts: [] } } };
      }
    };

    await openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }).listAccounts();

    expect(shell.asked[0].payload).toEqual({ user_id: OWNER });
  });

  it('refuses a document whose owner is not a uuid, before anything is asked', () => {
    // R-3, refused where it can still be understood — a foreign key violation on
    // the first write, or an empty ledger on the first read, are the two ways
    // this goes wrong when it is not checked here.
    const invoke = vi.fn();

    expect(() =>
      openDeviceDocument({ ledger: { path: '/x.db', owner: 'local-device' }, invoke })
    ).toThrow(/is not one/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('supplies the REAL backup format, not a copy of it', () => {
    // B-11: one format, read by every edition. A desktop with a builder of its
    // own would write files the cloud could not read, and nothing would say so
    // until somebody needed the file.
    const format = deviceBackupFormat();

    expect(format.steps).toBe(RESTORE_STEPS);
    expect(format.build).toBe(buildBackupBundle);
    expect(format.rowsForStep).toBe(rowsForStep);
  });

  it('supplies a planner that mints ids and takes no options', () => {
    // A total migration lands in a store that has just been wiped, so there is
    // nothing to match onto and nothing to suppress.
    const migration = deviceMsMoneyMigration();

    const plan = migration.plan(EMPTY_MNY as never, OWNER);

    expect(plan.accounts).toEqual([]);
    expect(plan.transactions).toEqual([]);
  });
});
