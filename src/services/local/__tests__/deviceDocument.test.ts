/**
 * The desktop's document: what it is assembled from, and the ORDER it boots in.
 *
 * Both questions are about wiring rather than about a ledger, so neither needs a
 * file or a Rust toolchain — the real engine is proved by the contract suite.
 * What is here is the half a contract cannot state: the seam requires categories
 * to be resolved before any transaction or budget read, and on this engine that
 * ordering is kept by the CALL SITE rather than inside a verb.
 *
 * Slice 28 added the other two things one open document has to answer for — the
 * IDENTITY and the SETTINGS — and both are wiring in exactly the same sense. A
 * preferences service attached to the wrong id, or pointed at the wrong store,
 * fails silently and much later.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bootDeviceLedger,
  deviceBackupFormat,
  deviceMsMoneyMigration,
  openDeviceDocument,
  type DevicePreferences
} from '../deviceDocument';
import {
  currentDeviceIdentity,
  forgetDeviceIdentity,
  requireDeviceOwner
} from '../deviceIdentity';
import type { PreferencesTransport } from '../../preferences/document';
import { RESTORE_STEPS, buildBackupBundle, rowsForStep } from '../../backup/format';

const OWNER = '11111111-1111-1111-1111-111111111111';
const SOMEBODY_ELSE = '22222222-2222-2222-2222-222222222222';

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
      if (verb === 'read_preferences') return { ok: true, result: { answer: { preferences: null } } };
      if (verb === 'list_accounts') return { ok: true, result: { answer: { accounts: [] } } };
      return { ok: true, result: { answer: {} } };
    }
  };
};

/** The preferences singleton's two methods, recorded rather than performed. */
const preferencesRecording = (): DevicePreferences & {
  readonly stores: (PreferencesTransport | null)[];
  readonly attached: string[];
  readonly calls: string[];
} => {
  const stores: (PreferencesTransport | null)[] = [];
  const attached: string[] = [];
  const calls: string[] = [];
  return {
    stores,
    attached,
    calls,
    useTransport(transport) {
      stores.push(transport);
      calls.push('useTransport');
    },
    async attach(userId) {
      attached.push(userId);
      calls.push('attach');
    }
  };
};

afterEach(() => {
  forgetDeviceIdentity();
});

describe('the device boot', () => {
  it('resolves categories BEFORE it reads the ledger', async () => {
    // `localDataPort.ts` states the obligation this test holds: *"The device
    // boot slice 27 writes must `await port.prepareCategories()` before
    // `port.loadBoot()`."* The cloud keeps the same ordering inside its own
    // loadBoot; a file cannot, because its load_boot is one crossing of one
    // transaction and seeding is a deliberate act rather than a side effect of
    // looking at a file.
    const shell = shellRecording();
    const document = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });

    await bootDeviceLedger(document);

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

    const boot = await bootDeviceLedger(
      openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke })
    );

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

describe('the settings, attached to the file', () => {
  it('points the service at THIS file and binds it to the file’s own owner', async () => {
    // The whole of slice 28's third piece in one assertion. The store is the
    // document's — not the cloud's, not the browser mirror — and the identity is
    // the uuid in the file's `users` row rather than anything a session
    // supplied.
    const shell = shellRecording();
    const document = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });
    const preferences = preferencesRecording();

    await bootDeviceLedger(document, { preferences });

    expect(preferences.stores).toEqual([document.preferences]);
    expect(preferences.attached).toEqual([OWNER]);
  });

  it('says which store before it says who, because attach reads from the store', async () => {
    // `attach` resolves the transport when it runs. The other order would read
    // the settings out of whatever store the previous session left configured —
    // on a desktop that is the cloud's, which is absent, so a person's whole
    // document would silently come back as "nothing saved yet" and the lift
    // would overwrite the file's real settings with this window's defaults.
    const shell = shellRecording();
    const preferences = preferencesRecording();

    await bootDeviceLedger(openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }), {
      preferences
    });

    expect(preferences.calls).toEqual(['useTransport', 'attach']);
  });

  it('starts the attach before the seed and still finishes it before answering', async () => {
    // The divergence from the cloud, which fires `void attach(...)` and never
    // waits. There is no round trip here to keep off the critical path, and
    // awaiting buys a first paint that is the person's own rather than the
    // defaults corrected a frame later. It is STARTED first so its crossing
    // overlaps the seed instead of delaying it.
    const shell = shellRecording();
    const document = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });
    const order: string[] = [];
    const preferences: DevicePreferences = {
      useTransport: () => {
        order.push('useTransport');
      },
      attach: async () => {
        order.push('attach started');
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push('attach finished');
      }
    };
    const port = document.port;
    const seed = vi.spyOn(port, 'prepareCategories');
    seed.mockImplementation(async () => {
      order.push('seed');
      return [];
    });

    await bootDeviceLedger(document, { preferences });

    expect(order.indexOf('attach started')).toBeLessThan(order.indexOf('seed'));
    expect(order).toContain('attach finished');
    expect(order.indexOf('attach finished')).toBeGreaterThan(order.indexOf('seed'));
  });

  it('boots the ledger anyway when the settings cannot be attached', async () => {
    // A ledger must never fail to open because a toggle could not be read. The
    // real `attach` swallows its own read failure and falls back to this
    // machine's copy — the behaviour the cloud already relies on for an offline
    // sign-in — and this proves the boot does not undo that by awaiting it.
    const shell = shellRecording();
    const preferences: DevicePreferences = {
      useTransport: () => {},
      attach: async () => {
        await Promise.resolve();
      }
    };

    const boot = await bootDeviceLedger(
      openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }),
      { preferences }
    );

    expect(boot.accounts).toEqual([]);
  });

  it('leaves the settings alone when nothing was given to attach', async () => {
    // The shell's current renderer mounts no React and reads no setting, so it
    // passes none. The absence must be a no-op rather than an error, and it must
    // not quietly point the app at a store that is not this file.
    const shell = shellRecording();

    await expect(
      bootDeviceLedger(openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }))
    ).resolves.toBeDefined();
    expect(shell.verbs).toEqual(['seed_categories', 'load_boot']);
  });

  it('refuses to attach a document that is not the ledger this window has open', async () => {
    // Opening a second ledger republishes the identity. Booting the FIRST one
    // afterwards would attach that file's settings under the second file's
    // owner, and the transport's own guard would then refuse every write at some
    // later, quieter moment. Caught here, before anything is read.
    const shell = shellRecording();
    const first = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });
    openDeviceDocument({
      ledger: { path: '/Users/somebody/Theirs.db', owner: SOMEBODY_ELSE },
      invoke: shell.invoke
    });

    await expect(
      bootDeviceLedger(first, { preferences: preferencesRecording() })
    ).rejects.toThrow(/has .* ledger open and was asked to boot/);
  });
});

describe('who this window belongs to', () => {
  it('publishes the FILE’s owner, not a constant and not a session id', async () => {
    // The mutation this exists for: an identity wired to anything other than the
    // uuid in the file's own users row. A device has no Clerk id and no database
    // lookup — `userIdService` reaches a Supabase client and could not be
    // imported here even if there were something for it to translate.
    openDeviceDocument({ ledger: LEDGER, invoke: shellRecording().invoke });

    expect(currentDeviceIdentity()).toEqual({ owner: OWNER, path: LEDGER.path });
    expect(requireDeviceOwner()).toBe(OWNER);
  });

  it('answers nothing before a ledger is opened, and says so rather than guessing', () => {
    expect(currentDeviceIdentity()).toBeNull();
    expect(() => requireDeviceOwner()).toThrow(/No ledger is open/);
  });

  it('forgets it when the ledger is closed', () => {
    openDeviceDocument({ ledger: LEDGER, invoke: shellRecording().invoke });

    forgetDeviceIdentity();

    expect(currentDeviceIdentity()).toBeNull();
  });

  it('replaces it when a second ledger is opened', () => {
    // The shell holds one document per window: opening another drops the first,
    // claim and all. The identity has to follow, or the app would go on
    // answering with a file it no longer has open.
    openDeviceDocument({ ledger: LEDGER, invoke: shellRecording().invoke });

    openDeviceDocument({
      ledger: { path: '/Users/somebody/Theirs.db', owner: SOMEBODY_ELSE },
      invoke: shellRecording().invoke
    });

    expect(requireDeviceOwner()).toBe(SOMEBODY_ELSE);
  });

  it('is not published at all when the owner is not a uuid', () => {
    // R-3, and the ORDER that makes it hold: the port refuses first, so the app
    // above is never told an identity the engine below has already rejected.
    expect(() =>
      openDeviceDocument({
        ledger: { path: '/x.db', owner: 'local-device' },
        invoke: shellRecording().invoke
      })
    ).toThrow(/is not one/);
    expect(currentDeviceIdentity()).toBeNull();
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

    await openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke }).port.listAccounts();

    expect(shell.asked[0].payload).toEqual({ user_id: OWNER });
  });

  it('gives the port and the settings the SAME transport', async () => {
    // One connection behind one mutex. Two transports would not buy concurrency;
    // they would buy two objects a later caller could point at two documents.
    const shell = shellRecording();
    const document = openDeviceDocument({ ledger: LEDGER, invoke: shell.invoke });

    await document.port.listAccounts();
    await document.preferences.read(OWNER);

    expect(shell.verbs).toEqual(['list_accounts', 'read_preferences']);
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
