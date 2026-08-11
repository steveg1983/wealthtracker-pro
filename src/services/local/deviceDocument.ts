/**
 * A ledger file, as the desktop shell hands it to the app.
 *
 * The shell's three file commands answer with a path and an owner; this module
 * turns that answer into a `DataPort` the rest of the application can use, and
 * states the one thing about booting a device that no engine can state for
 * itself.
 *
 * ── IT IS THE DESKTOP BUNDLE'S ROOT, AND THAT IS WHAT MAKES IT TESTABLE ─────
 *
 * PHASE3-PLAN §5 asks for two bundle greps: a desktop build must contain no
 * Supabase client and no browser storage adapter. A grep over a built bundle can
 * only be run where there is a built bundle. This module is the one place the
 * desktop's whole object graph is assembled — the port, the transport, the
 * backup format, the .mny planner — so the same question can be asked of the
 * IMPORT GRAPH instead, from here, on every test run and on every machine.
 * `deviceDocument.cloudFree.test.ts` is that grep, executed.
 *
 * Which is also why the suppliers below are here rather than in
 * `apps/desktop/ui`: everything under `apps/` is outside this repo's lint,
 * typecheck and test roots, and a wiring decision that nothing checks is a
 * wiring decision that drifts. What lives in the shell's renderer is one line —
 * where `invoke` comes from — and nothing else.
 */

import { RESTORE_STEPS, buildBackupBundle, remapBackupIds, rowsForStep } from '../backup/format';
import { planCloudImport } from '../import/msMoney/cloudPlan';
import type { BootSnapshot } from '../port/dataPort';
import { createInvokeTransport, type Invoke } from './coreTransport';
import {
  LocalDataPort,
  type BackupFormat,
  type MsMoneyMigration
} from './localDataPort';

/**
 * What the shell's `open_ledger`, `create_ledger` and `current_ledger` answer
 * with — the Rust side's `OpenLedger`, in this app's spelling.
 *
 * The PATH is here to be shown, never to be sent: `document.rs` explains at
 * length why a path may not cross the invoke boundary in the other direction.
 */
export interface OpenLedger {
  /** Where the file is, for the window title and the "which ledger?" question. */
  readonly path: string;
  /** The uuid in the file's one `users` row. See D-5. */
  readonly owner: string;
}

/**
 * The real backup format, for a bundle that may not import `backupService.ts`.
 *
 * These are the SAME four functions the cloud export and the browser export
 * call, from the module slice 27 lifted them into. B-11 turns on there being one
 * of them: a file this edition writes has to be one every other edition can
 * read, and a second builder would break that on the first divergence nobody
 * noticed.
 *
 * The id generator is the app's own `crypto.randomUUID`, which is
 * `remapBackupIds`'s default — passed explicitly because a default that arrives
 * by omission is a decision nobody made.
 */
export const deviceBackupFormat = (): BackupFormat => ({
  steps: RESTORE_STEPS,
  build: buildBackupBundle,
  rowsForStep,
  remapIds: bundle => remapBackupIds(bundle, () => crypto.randomUUID())
});

/**
 * The real .mny planner, for a bundle that may not import the importer.
 *
 * `planCloudImport` with no options, which is what a TOTAL migration means: it
 * lands in a store that has just been wiped, so there is nothing to match onto,
 * nothing to suppress and no bank-feed row to hand a transfer leg over to. The
 * port's `MsMoneyMigration` says exactly that where it declares the method.
 *
 * The ids this mints never reach the file — `restoreBackup` remaps every one of
 * them before a row is sent — so the generator exists only to make the plan
 * self-consistent.
 */
export const deviceMsMoneyMigration = (): MsMoneyMigration => ({
  plan: (result, owner) => planCloudImport(result, owner, () => crypto.randomUUID())
});

/** Everything the port needs, and the one thing only the shell can provide. */
export interface DeviceDocumentOptions {
  /** The open file, as the shell described it. */
  readonly ledger: OpenLedger;
  /** Tauri's `invoke`, from the renderer. See {@link Invoke}. */
  readonly invoke: Invoke;
  /**
   * Where a read that could not happen is reported. Defaults to the port's own
   * console logger, never to silence.
   */
  readonly logger?: { error: (message: string, error: unknown) => void };
}

/**
 * The app's data engine for one open file.
 *
 * Every argument is supplied rather than imported, which is the same statement
 * the port makes about itself three times over: it holds no opinion about how a
 * file is reached, what a backup looks like, or how a .mny file becomes rows.
 * This module is where those opinions live for a desktop.
 */
export const openDeviceDocument = (options: DeviceDocumentOptions): LocalDataPort =>
  new LocalDataPort({
    owner: options.ledger.owner,
    transport: createInvokeTransport(options.invoke),
    format: deviceBackupFormat(),
    migration: deviceMsMoneyMigration(),
    ...(options.logger === undefined ? {} : { logger: options.logger })
  });

/**
 * Boot a device — and the reason this function exists rather than a call to
 * `loadBoot`.
 *
 * ── THE ORDERING IS THE CALLER'S HERE, AND ONLY HERE ────────────────────────
 *
 * The seam requires that categories are resolved *"before any transaction or
 * budget read"*. Every engine owes it; they do not all keep it in the same
 * place. The cloud keeps it INSIDE its own `loadBoot`. A file cannot: the local
 * `load_boot` is ONE crossing of ONE transaction, and seeding is a deliberate
 * act rather than a side effect of looking at a file — `localDataPort.ts` says
 * so where `prepareCategories` is defined, and the contract suite SPIES on that
 * method and fails the composite if the boot reached it.
 *
 * > *"So the ordering the seam states for every engine … is kept by the CALL
 * > SITE here … The device boot slice 27 writes must `await
 * > port.prepareCategories()` before `port.loadBoot()`."*
 *
 * This is that call site. Two lines, in that order, and a test that fails if
 * they are ever the other way round — because the failure they prevent is
 * silent: a first launch would draw a register whose every row is filed against
 * a category that does not exist yet.
 *
 * It is idempotent, so every launch after the first costs one crossing that
 * answers out of the file it was about to read anyway.
 */
export const bootDeviceLedger = async (port: LocalDataPort): Promise<BootSnapshot> => {
  await port.prepareCategories();
  return port.loadBoot();
};
