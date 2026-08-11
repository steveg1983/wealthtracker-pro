/**
 * A ledger file, as the desktop shell hands it to the app.
 *
 * The shell's three file commands answer with a path and an owner; this module
 * turns that answer into the three things the rest of the application needs —
 * an engine, an identity and a settings store — and states the one thing about
 * booting a device that no engine can state for itself.
 *
 * ── IT IS THE DESKTOP BUNDLE'S ROOT, AND THAT IS WHAT MAKES IT TESTABLE ─────
 *
 * PHASE3-PLAN §5 asks for two bundle greps: a desktop build must contain no
 * Supabase client and no browser storage adapter. A grep over a built bundle can
 * only be run where there is a built bundle. This module is the one place the
 * desktop's whole object graph is assembled — the port, the transport, the
 * backup format, the .mny planner, and since slice 28 the preferences store and
 * the identity — so the same question can be asked of the IMPORT GRAPH instead,
 * from here, on every test run and on every machine.
 * `deviceDocument.cloudFree.test.ts` is that grep, executed.
 *
 * Which is also why the suppliers below are here rather than under
 * `apps/desktop`: everything under `apps/` is outside this repo's lint,
 * typecheck and test roots, and a wiring decision that nothing checks is a
 * wiring decision that drifts. Slice 29 took that argument to its conclusion and
 * moved the whole renderer to `src/desktop`, so what is left under `apps/` is
 * the Rust shell and one build config. `src/desktop/main.tsx` is now a SECOND
 * root the same walk is run from (`desktopEntry.cloudFree.test.ts`), because a
 * component tree can reach cloud modules this file knows nothing about.
 */

import { RESTORE_STEPS, buildBackupBundle, remapBackupIds, rowsForStep } from '../backup/format';
import { planCloudImport } from '../import/msMoney/cloudPlan';
import type { PreferencesTransport } from '../preferences/document';
import type { BootSnapshot } from '../port/dataPort';
import { createInvokeTransport, type Invoke } from './coreTransport';
import { adoptDeviceIdentity, requireDeviceOwner, type DeviceIdentity } from './deviceIdentity';
import {
  LocalDataPort,
  type BackupFormat,
  type MsMoneyMigration
} from './localDataPort';
import { localPreferencesTransport } from './preferencesTransport';

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
 * One open ledger file, in the three shapes the application above it needs.
 *
 * ── WHY THIS IS A TRIPLE AND NOT JUST THE PORT ──────────────────────────────
 *
 * Until slice 28 `openDeviceDocument` answered with a `DataPort` and that was
 * all a device had. It is not all a device IS. A signed-in browser session
 * carries three things that a file has to answer for on its own, and the seam
 * only covers the first:
 *
 *   the ENGINE     the ledger's rows — `DataPort`, and the whole of Phase 3;
 *   the IDENTITY   who these rows belong to, which the cloud gets from Clerk
 *                  through `userIdService` and a device gets from the file;
 *   the SETTINGS   how this person reads their ledger, which the cloud keeps in
 *                  a `user_preferences` row and a device keeps in the file.
 *
 * They come out of ONE open document because they are one open document: the
 * identity is the owner the port was constructed with, and the settings store
 * speaks to the file over THE SAME transport the port uses. Handing back a port
 * alone and letting a caller assemble the other two would be handing back the
 * chance for three answers about one file to disagree.
 */
export interface DeviceDocument {
  /** The app's data engine for this file. */
  readonly port: LocalDataPort;
  /** Whose file it is, and where. Also published — see `deviceIdentity.ts`. */
  readonly identity: DeviceIdentity;
  /** This file's settings, as the preferences seam. */
  readonly preferences: PreferencesTransport;
}

/**
 * Open one file, as everything above the seam needs to see it.
 *
 * Every argument is supplied rather than imported, which is the same statement
 * the port makes about itself three times over: it holds no opinion about how a
 * file is reached, what a backup looks like, or how a .mny file becomes rows.
 * This module is where those opinions live for a desktop.
 *
 * ── ONE TRANSPORT, SHARED ───────────────────────────────────────────────────
 *
 * The port and the preferences store are given the SAME {@link CoreTransport}
 * rather than one each. There is one connection behind one mutex in the shell,
 * so a second transport would not buy concurrency — it would buy two objects
 * that could be pointed at two different documents by a future caller who did
 * not notice there were two.
 *
 * ── THE IDENTITY IS PUBLISHED LAST ──────────────────────────────────────────
 *
 * `new LocalDataPort` refuses an owner that is not a uuid (R-3, at construction,
 * so it fails where it can still be understood). Constructing the port FIRST
 * means a malformed owner never reaches `adoptDeviceIdentity`, and the app above
 * is never told an identity the engine below has already rejected.
 */
/** The open document. Declared here, explained at {@link currentDeviceDocument}. */
let open: DeviceDocument | null = null;

export const openDeviceDocument = (options: DeviceDocumentOptions): DeviceDocument => {
  const transport = createInvokeTransport(options.invoke);
  const { owner, path } = options.ledger;

  const port = new LocalDataPort({
    owner,
    transport,
    format: deviceBackupFormat(),
    migration: deviceMsMoneyMigration(),
    ...(options.logger === undefined ? {} : { logger: options.logger })
  });

  const identity: DeviceIdentity = { owner, path };
  adoptDeviceIdentity(identity);

  const document: DeviceDocument = {
    port,
    identity,
    preferences: localPreferencesTransport({ owner, transport })
  };
  open = document;
  return document;
};

/**
 * The document this window has open, remembered — and why a module-scope value
 * is the right shape for it.
 *
 * It is the same argument `deviceIdentity.ts` makes about the owner, one layer
 * out. Slice 28 published the identity here because the callers that need it are
 * `useState` initialisers and hooks scattered across pages that mount at
 * different times, and an argument cannot reach them. The ENGINE has exactly the
 * same callers: `dataPort` is a module-scope singleton in every edition, because
 * thirteen components import it as one.
 *
 * So a desktop's engine is published the way its identity is, from the one
 * function that assembles a document, and `deviceDataPort.ts` — the desktop's
 * choosing line, the file `@data` resolves to when the app is built for a
 * window — reads it. That module is ONE line, exactly as `services/port/index.ts`
 * is one line, and this is what makes the two interchangeable.
 *
 * Not reactive, for the reason the identity is not: the engine cannot change
 * under a mounted tree. Opening a different ledger replaces the document and the
 * app is booted against it.
 *
 * @returns the open document, or `null` when this window has no ledger.
 */
export const currentDeviceDocument = (): DeviceDocument | null => open;

/**
 * The open document, or a sentence saying there is not one.
 *
 * THE ORDERING RULE OF THE DESKTOP MOUNT, and the reason this throws rather than
 * answering something empty. `deviceDataPort.ts` resolves the app's `dataPort`
 * out of this at MODULE SCOPE, so a desktop build that imported the application
 * before a file was open would bind every screen to nothing — and the failure
 * would not arrive here, where it can be understood, but later and one screen at
 * a time, as reads that answer with no rows.
 *
 * A window cannot render a ledger it has not opened, so the ordering is a
 * property of the product rather than a discipline: `src/desktop/main.tsx`
 * chooses a file, opens it, boots it, and only then loads the application's
 * module graph. This sentence is what a future entry that forgot will read.
 *
 * @throws when no ledger is open in this window.
 */
export const requireDeviceDocument = (): DeviceDocument => {
  if (open === null) {
    throw new Error(
      'No ledger is open in this window, so there is no data to read. A ledger must be ' +
        'opened before the application is loaded — see src/desktop/main.tsx.'
    );
  }
  return open;
};

/**
 * Forget it — what `close_ledger` means to the layer above the seam, and the
 * companion to `forgetDeviceIdentity` for the same reason: this is module state,
 * and a suite that left one case's document standing would be a suite in which
 * the next case read the previous case's ledger.
 */
export const forgetDeviceDocument = (): void => {
  open = null;
};

/**
 * The preferences singleton, as this module needs to see it.
 *
 * INJECTED, and it is the one dependency here that could not be imported even
 * if the injection were unwanted: `preferencesService.ts` reaches a Supabase
 * client and the app's cloud-bound logger on its first two lines, and this
 * module is the root `deviceDocument.cloudFree.test.ts` walks. Whatever mounts
 * the React application on a desktop hands over the same instance every surface
 * renders through — a second one would leave every screen reading a document
 * nobody had attached.
 *
 * Two methods, in the order they must be called. Structural rather than the
 * class, so this module names no cloud even in a type position.
 */
export interface DevicePreferences {
  /** `PreferencesService.useTransport` — say which store the settings live in. */
  useTransport(transport: PreferencesTransport | null): void;
  /** `PreferencesService.attach` — bind to an owner and load their document. */
  attach(userId: string): Promise<void>;
}

/** What a boot may be given beyond the document itself. */
export interface DeviceBootOptions {
  /**
   * The preferences singleton, when there is one to bind.
   *
   * OPTIONAL, and the absence is a real state rather than a convenience: the
   * shell's current renderer draws one screen and mounts no React, so it has no
   * preferences service and nothing in it reads a setting. A boot without one
   * leaves the settings exactly where they were — which for a window with no
   * surfaces is nothing at all, and for a window with them would be the
   * WebView's own `localStorage`, a store that is not in the backup and does not
   * travel with the file. That is why the mount slice must pass one.
   */
  readonly preferences?: DevicePreferences;
}

/**
 * Boot a device — and the two things this function exists to say that a call to
 * `loadBoot` cannot.
 *
 * ── 1. THE CATEGORY ORDERING IS THE CALLER'S HERE, AND ONLY HERE ────────────
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
 *
 * ── 2. THE SETTINGS ARE ATTACHED, AND THIS ONE IS AWAITED ───────────────────
 *
 * The cloud deliberately does NOT await its attach: `AppContextSupabase` fires
 * `void preferencesService.attach(databaseId)` because it is *"one small read
 * that nothing on the critical path depends on"* and awaiting it *"would put a
 * round trip in front of the first account query for no gain"*.
 *
 * A round trip is exactly what a device does not have. The read is one invoke
 * into the same process, and the mutex serialises it against the seed and the
 * boot whether it is awaited or not — so awaiting costs nothing measurable and
 * buys a real property: the caller gets a boot in which the theme, the currency
 * and the pinned accounts are ALREADY in memory, so the first paint is the
 * person's own rather than the defaults corrected a frame later.
 *
 * It is STARTED FIRST and awaited LAST so that its crossing overlaps the seed
 * rather than delaying it, and it cannot fail the boot: `attach` catches its own
 * read failure and falls back to this machine's copy, which is the behaviour the
 * cloud relies on for an offline sign-in. A ledger must never fail to open
 * because a toggle could not be read.
 *
 * The identity it attaches to is the FILE'S OWNER, read from
 * `deviceIdentity.ts` rather than passed in, because that is the module the rest
 * of the app will ask the same question of — and an attach that took its own id
 * from somewhere else would be the first place the two answers could differ.
 */
export const bootDeviceLedger = async (
  document: DeviceDocument,
  options: DeviceBootOptions = {}
): Promise<BootSnapshot> => {
  const settings = attachSettings(document, options.preferences);
  await document.port.prepareCategories();
  const boot = await document.port.loadBoot();
  await settings;
  return boot;
};

/**
 * Point the preferences service at this file and bind it to the file's owner.
 *
 * Separated from the boot above so that the boot reads as three ordered
 * statements. `useTransport` before `attach` is not a style choice: `attach`
 * resolves the store to read from, so calling it first would read the settings
 * out of whatever store the previous session left configured.
 */
const attachSettings = async (
  document: DeviceDocument,
  preferences: DevicePreferences | undefined
): Promise<void> => {
  if (preferences === undefined) return;
  preferences.useTransport(document.preferences);
  await preferences.attach(requireOwnerOf(document));
};

/**
 * The owner to attach to — asked of the PUBLISHED identity, and checked against
 * the document being booted.
 *
 * It would be shorter to read `document.identity.owner`, and that would prove
 * nothing. This is the same question every component above the seam asks
 * (`requireDeviceOwner`), so the boot asking it too is what makes the published
 * answer load-bearing rather than decorative: if it were ever wired to a
 * constant, or left standing from a previous file, this is where it is caught.
 *
 * The case it really catches is a second document. `openDeviceDocument`
 * republishes the identity every time it is called, so opening B and then
 * booting A would attach A's FILE to B's owner — and the settings would then be
 * refused by `preferencesTransport`'s own guard at some later, quieter moment.
 * Here it is a sentence, before anything has been read.
 */
const requireOwnerOf = (document: DeviceDocument): string => {
  const published = requireDeviceOwner();
  if (published !== document.identity.owner) {
    throw new Error(
      `This window has ${published}'s ledger open and was asked to boot ${document.identity.owner}'s. ` +
        'Nothing was read. Open the ledger again.'
    );
  }
  return published;
};
