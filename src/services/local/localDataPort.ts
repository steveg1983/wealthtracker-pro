/**
 * The seam, answered by a file on this device.
 *
 * The second implementation of `DataPort`, and the reason the seam was named at
 * all. It holds no SQL, no schema knowledge and no query language: every
 * question it asks is one verb over {@link CoreTransport}, and the ledger crate
 * decides what a verb means. What lives here is the other half of that
 * conversation — the owner, the app's shapes, and the promises the seam makes
 * that a verb cannot make for itself.
 *
 * ── WHAT THIS FILE IMPLEMENTS: ALL OF IT ────────────────────────────────────
 *
 * The eleven reads, the boot composite, the capability descriptor, the two
 * lifecycle no-ops, the sixteen writes slice 19 wired, the three ACCOUNT writes
 * slice 20 added — the first the crate had no Postgres function to port
 * (PHASE3-PLAN D-2: the cloud writes `accounts` directly over PostgREST, so the
 * oracle is the TypeScript writer and `schema.sql`'s constraints) — the four
 * CATEGORY writes and `prepareCategories` from slice 21, which is the same kind
 * of port with one addition (the writer it ports, `ensureCategories`, calls an
 * RPC of its own, and only the third of its three steps is that RPC) — and,
 * since slice 22, the three BUDGET writes and the three GOAL writes, which is
 * D-2's argument a third time and the first family to keep an audit trail the
 * cloud keeps for neither table (DESIGN.md §5 divergence 10, ruled in
 * PHASE1-PLAN §2.2 long before the verbs existed) — and, since slice 23, the
 * two DISMISSAL writes, which is D-2's argument a fourth time and the first
 * family to AGREE with the cloud about the audit log: divergence 10 turns on
 * money living in four columns, and a dismissal holds no figure in either
 * engine, so both write nothing and the agreement is argued rather than assumed.
 *
 * Since slice 25 it also holds the RE-POINT and the whole BACKUP group, which is
 * the round trip: `collectBackup` reads fifteen tables in one snapshot and
 * hands the rows to the app's own `buildBackupBundle`, and `restoreBackup` sends
 * the file back in ONE call that is ONE transaction.
 *
 * SLICE 28 GAVE THAT ROUND TRIP ITS FIFTEENTH THING. A backup carries the
 * PREFERENCES document as a top-level section rather than as one of the fifteen
 * tables, and until this slice a file could not hold one — `collectBackup` sent
 * `null` and `restoreBackup` reported a loss it had no way to avoid. Both now
 * cross, as two verbs of their own: see those two methods for why the collect is
 * allowed to reject and the restore deliberately is not, and why the settings
 * are written AFTER the one transaction rather than inside it.
 *
 * SLICE 26 CLOSED IT. `importMsMoney` was the last operation of the seam this
 * port did not answer, and it is the one the ratchet said would need no new rule:
 * a total migration IS a wipe and a restore, so it is written as those two and
 * nothing else. The class therefore says `implements DataPort` — checked by
 * `tsc -b`, which does compile this file — and `contract.ts`'s `NOT_YET` ratchet,
 * its ceiling and its skip-by-name machinery were DELETED in the same commit
 * rather than left holding an empty array. Every rule in the contract suite now
 * RUNS on this engine; none is skipped.
 *
 * ── WHAT A WRITE HANDS BACK, AND THE ONE COLUMN IT USED NOT TO ──────────────
 *
 * Every write below answers with the row as stored, mapped by the same
 * `toTransaction` the reads use — and since slice 27 that is honest for both,
 * because the crate answers writes with a projection of their own.
 *
 * It did not used to be. A verb's result was `TransactionRow`, which IS the
 * audit entry's shape, and the audit entry carries neither `needs_review` nor
 * the two timestamps (see `crate::row`, which says so and says why no two of the
 * three projections is a subset of another). So a written row came back with
 * `needsReview: false` whatever the file held: an update that did not mention
 * the flag un-bolded an imported row in the register until the next read.
 *
 * The fix is `crate::row::WrittenTransaction` — the audit row plus that one
 * column — and it is a WRAPPER rather than a widening, because widening
 * `TransactionRow` would change the audit payload two engines compare field by
 * field and re-chain every hash. `toTransaction` reads the flag off a write's
 * answer now exactly as it reads it off a boot's row, and there is no branch
 * here that knows which it was given.
 *
 * THE TWO TIMESTAMPS ARE STILL ABSENT, and that stays a decision rather than a
 * gap: nothing reads `createdAt` or `updatedAt` off a write's answer, and a
 * projection that carried them would have to be compared across two engines
 * whose clocks are two processes — `scripts/local-sqlite/verb-specs/_shared.mjs`
 * pins them in every READ spec for exactly that reason, and a write has no
 * moment to pin.
 *
 * The class says `implements DataPort`, and that is the alias `LocalDataPortSurface`
 * being deleted rather than a comment being updated: while the engine was
 * half-built the declaration named an intersection of the interfaces it really
 * answered, so the compiler could check every operation that was CLAIMED without
 * blessing the ones that were missing. There is nothing left to leave out.
 *
 * ── THE OWNER (PHASE3-PLAN D-5) ─────────────────────────────────────────────
 *
 * Seam rule 1: no operation takes a user id, every implementation resolves its
 * own owner. Every read verb in the crate REQUIRES one — a local file can hold
 * more than one login's rows (a restored backup from an account that had two)
 * and there is no RLS to narrow an answer afterwards — so the port must have an
 * owner before it can ask anything.
 *
 * Whose? Not `LOCAL_SOURCE_USER_ID` ('local-device'): `schema.sql`'s users table
 * carries `CHECK (id = lower(id) AND length(id) = 36)` and would refuse it. That
 * string stays what it already is, a provenance marker in the browser bundle.
 * The owner of a local file is a uuid minted when the FILE is created, stored in
 * its one `users` row.
 *
 * The port is CONSTRUCTED with the open document — its transport and its owner —
 * and caches that owner for the document's life, which is D-5's *"resolves owner
 * ONCE at open"* with the resolution living in the thing that opens files. A
 * port is never told an owner per call, and there is nowhere to pass one.
 *
 * WHERE THE UUID COMES FROM, now that all three ends exist. Slice 27's shell
 * mints it (`document.rs`'s `create`, a v4 uuid written into the file's one
 * `users` row) and reads it back on every open, refusing by name a file that has
 * none and a file that has two. Slice 28 published it to the layer ABOVE this
 * one: `services/local/deviceIdentity.ts` is what a component asks instead of
 * `userIdService`, which is the Clerk↔database translator and reaches a Supabase
 * client a device has no use for and cannot bundle.
 *
 * This port does not read that module and must not. `#owner` stays private and
 * the identity travels the other way — from whoever opened the file, into the
 * constructor — because a port that could look its owner up is a port whose
 * owner could change under it between two verbs.
 *
 * The uuid shape is CHECKED at construction rather than trusted, so R-3 fails
 * here — by name, with the schema's own rule quoted — instead of as a foreign
 * key violation on the first write, or as an empty ledger on the first read.
 *
 * ── THE READS THAT MAY NOT REJECT ───────────────────────────────────────────
 *
 * `loadBoot`, `loadBootTransactions` and `getAccountBalances` are the three the
 * seam says never reject, and this is where that is made true for a file. The
 * boot effect has ONE outer catch and reaching it replaces the whole app with
 * "Failed to load data" — for somebody whose ledger is fine and whose next
 * launch would have worked. So a transport that rejects costs whatever could
 * not be read, said out loud, and never a thrown promise. The crate deliberately
 * does NOT soften its own storage faults for the same reason its `load_boot`
 * documentation gives: six empty lists is what a NEW FILE legitimately answers
 * with, and a verb that said the same thing about a file it could not open would
 * make the two indistinguishable. One layer knows the difference, and it is this
 * one.
 *
 * ── THE STATS VOCABULARY IS THIS FILE'S, AND IT HAS TWO WORDS ───────────────
 *
 * `BootTransactionStats.fullFetchReason` says where a boot's rows came from.
 * Divergence B-1 gives the local core `'local mode'` — the same word browser
 * storage uses, and honest for the same reason: there is no snapshot layer,
 * because the rows are already on the device. The other word is `'load failed'`,
 * which is what `DataServiceImpl` already says when its own store will not open,
 * and it is the only answer available for a call that did not happen. A verb
 * cannot answer for the case where the verb did not run, which is why both words
 * live here rather than in the crate.
 */

import type {
  Account,
  AccountUpdate,
  Budget,
  Category,
  CategoryMergeResult,
  CustomReport,
  ForecastAdjustment,
  DismissalKind,
  Goal,
  SplitWriteResult,
  SuggestionDismissal,
  Transaction,
  TransactionSplit,
  TransactionSplitInput,
  TransferDisplacedDisposition,
  TransferRepointResult
} from '../../types';
import type {
  AccountBalanceSnapshot,
  BackupRestoreOutcome,
  BootSnapshot,
  BootTransactionStats,
  BootTransactionsResult,
  BulkImportResult,
  DataPortCapabilities,
  // The whole seam, in ONE name — no intersection of the groups this file
  // happens to answer, because it answers all of them. `tsc -b` compiles this
  // module, so `implements DataPort` below is a proof rather than a claim.
  DataPort,
  // A parsed .mny file and the phases a migration reports through. Taken from
  // the seam rather than from `services/import/msMoney`, which is where they
  // are declared: `dataPort.ts` re-exports both precisely so that an engine can
  // name them without importing the importer, whose module scope reaches the
  // browser's storage adapter and the app's cloud-bound logger.
  ImportProgress,
  InvestmentChanges,
  InvestmentDraft,
  InvestmentEvent,
  InvestmentHolding,
  MoneyNumber,
  MsMoneyImportResult,
  QuoteWriteback,
  ReconciliationOutcome
} from '../port/dataPort';
// The FILE FORMAT's own types, imported for the reason `dataPort.ts` imports
// them: `import type` is erased at build, and these describe a file on somebody's
// disk rather than an engine. The RUNTIME half of the same module is NOT imported
// — it is injected. See {@link BackupFormat}.
//
// From `backup/format.ts` rather than from `backupService.ts` since slice 27:
// the format was lifted into a module whose scope holds no Supabase client, and
// naming the lifted module here means the type and the injected implementation
// come from the same place even though only one of them is real at runtime.
import type {
  BackupBundle,
  BackupRow,
  BuildBundleInput,
  RemapResult,
  RestoreStep
} from '../backup/format';
// A MAPPER, not the format — which is why this one is imported at runtime while
// the four above are injected, and the line between them is worth stating.
//
// `BackupFormat`'s members describe a FILE ON DISK: how a bundle is assembled,
// what order it is applied in, how its ids are remapped. `parsePreferencesDocument`
// describes an ANSWER: it turns the `unknown` a verb hands back into the shape
// the app holds, refusing what it cannot read and keeping what it does not
// recognise — which is exactly what `toAccount` and `toTransaction` do for their
// rows, and those are imported. A file's preferences reach this port from
// `read_preferences`, not out of a backup, so the reader belongs on the mapper
// side of that line.
//
// It is safe to import for the reason slice 27 established: `preferences/document.ts`
// is the lifted half, and its module scope holds no Supabase client — which
// `deviceDocument.cloudFree.test.ts` walks this graph to prove on every run.
import { parsePreferencesDocument, type PreferencesDocument } from '../preferences/document';
// A MAPPER, imported at runtime for `parsePreferencesDocument`'s exact reason:
// it turns the `unknown` a verb hands back into the shape the app holds. It is
// also, and unusually, the CLOUD's own mapper — `services/api/investmentService`
// re-exports it — which is safe because slice 31 lifted it into
// `services/investments/holding.ts`, whose module scope holds no Supabase
// client. The alternative was a seventh hand-written row mapping in `rows.ts`,
// and a second interpretation of one table is the thing `columns.ts` exists to
// prevent.
import { toHolding, toHoldings } from '../investments/holding';
import type { CoreTransport } from './coreTransport';
// The ONE encoder, for the two arguments this port sends that are not part of a
// column table's payload: a finalize's ending balance and the two cutoff days.
// `encode` is where "money crosses as the number's own decimal text" and "a Date
// names its UTC day" are written down, and a second spelling of either here is
// exactly the drift `columns.ts` exists to prevent.
import { encode } from './mappers/columns';
import { countOf, day, field, listOf, money, moneyOr, rowOf, rowsOf, textOf } from './mappers/values';
import {
  toAccount,
  toBalance,
  toBudget,
  toCategory,
  toCustomReport,
  toForecastAdjustment,
  toDismissal,
  toDisplaced,
  toGoal,
  toSplit,
  toTransaction
} from './mappers/rows';
import {
  defaultCategorySeed,
  toAccountCreatePayload,
  toAccountUpdatePatch,
  toBudgetCreatePayload,
  toBudgetUpdatePatch,
  toCategoryCreatePayload,
  toCategoryUpdatePatch,
  toCreatePayload,
  toCustomReportCreatePayload,
  toCustomReportUpdatePatch,
  toDismissalKey,
  toDismissalPayload,
  toGoalCreatePayload,
  toGoalUpdatePatch,
  toImportRow,
  toInvestmentCreatePayload,
  toInvestmentUpdatePatch,
  toSplitLine,
  toUpdatePatch
} from './mappers/writes';

/*
 * `LocalDataPortSurface` USED TO BE DECLARED HERE, and it is worth one paragraph
 * to say what it was and why it has gone.
 *
 * While the engine was being built this file could not honestly say
 * `implements DataPort`: the class answered nine of the seam's thirteen
 * interfaces and would not compile against the whole of it. So the declaration
 * named an INTERSECTION of the groups that were really answered, which let
 * `tsc -b` check every operation that was claimed without blessing the ones that
 * were missing — a partial port that lies about its surface is exactly what
 * `contract.ts`'s ratchet existed to make impossible. Slice 26 landed the last
 * operation, so the alias's job is over and it is deleted rather than left
 * naming all thirteen interfaces in a row.
 *
 * WORTH READING BEFORE TRUSTING AN `Omit` AGAIN — kept, because the trap is
 * still there for the next person who reaches for one. Until slice 23 the alias
 * said `Omit<DataPortPlanningWrites, 'dismissSuggestion' | 'restoreSuggestion'>`,
 * and it read as *"the planning group minus the two that are left"*. It was not:
 * those two operations live in `DataPortDismissalWrites`, a separate interface,
 * and `DataPortPlanningWrites` has never had either key. So the `Omit` removed
 * nothing, and the two operations were excluded not by it but by the whole
 * dismissal interface being absent from that intersection.
 *
 * **`Omit<T, K>` does not require `K` to be a key of `T`.** The compiler accepts
 * a name that is not there and says nothing, so an `Omit` naming operations is a
 * comment that TypeScript does not check.
 */

/**
 * The backup FILE FORMAT, supplied to the port rather than imported by it.
 *
 * ── WHY THIS IS INJECTED AND THE MAPPERS ARE NOT ────────────────────────────
 *
 * `buildBackupBundle`, `remapBackupIds`, `RESTORE_STEPS` and `rowsForStep` are
 * PURE functions over rows, and the seam says so where it imports their types:
 * *"these types describe a file on the user's disk, not an engine … a local
 * edition inherits the format for the same reason it inherits the seam."* This
 * port must use those exact functions — a second builder of one format is a file
 * that exports what it cannot import, and the format is the only thing making a
 * backup portable between editions.
 *
 * It still does not IMPORT them, and the reason has changed shape. It used to be
 * that they lived in `services/backupService.ts`, whose first line is
 * `import { supabase }`, so a static import here would have put the cloud in the
 * desktop bundle — the exact thing PHASE3-PLAN §5's two bundle greps exist to
 * refuse, and the same reason `mappers/rows.ts` writes out six mappings whose
 * cloud twins it cannot reach.
 *
 * So the format arrives the way the logger and the transport arrive: from
 * whatever opened the document. That is not a workaround, it is the same
 * statement made three times — the port holds no opinion about how a file is
 * reached, where a fault is reported, or what a backup file looks like. It stays
 * injected now that the import would be safe, because an engine that reaches for
 * a file format on its own is an engine that has an opinion about one.
 *
 * ── THE OBLIGATION THIS LEFT, AND HOW IT WAS DISCHARGED ─────────────────────
 *
 * It read: *"whoever opens a document in the DESKTOP shell (slice 27) must
 * supply an implementation that does not itself reach a Supabase client. Today
 * that means lifting the pure format half out of `backupService.ts` into a
 * module of its own, which is a FILE MOVE — and a file move is a
 * `scripts/port-coverage` manifest change, so it belongs to the commit that has
 * a desktop bundle to measure."*
 *
 * Slice 27 is that commit. `services/backup/format.ts` is the lifted module and
 * `services/preferences/document.ts` is the one it dragged with it (the remapper
 * needs to know which preference keys hold ids, and that constant lived beside a
 * Supabase transport). `backupService.ts` re-exports both, so no existing caller
 * moved. The shell's `openLedgerDocument` supplies `BackupFormat` out of the
 * lifted module, and `deviceDocument.cloudFree.test.ts` walks the import graph
 * from there and fails if a Supabase client is reachable — which is that bundle
 * grep, executed rather than described.
 *
 * REQUIRED rather than optional, and that is R-3's discipline applied to a
 * second thing: a port constructed without a format could answer eleven reads
 * and then fail on the one operation whose failure costs somebody their whole
 * financial life. The compiler refuses instead.
 */
export interface BackupFormat {
  /** `RESTORE_STEPS` — the order a file must be applied in, and the labels. */
  readonly steps: readonly RestoreStep[];
  /** `buildBackupBundle` — rows in, the file the user downloads out. */
  build(input: BuildBundleInput): BackupBundle;
  /** `rowsForStep` — one step's rows, including the three category levels. */
  rowsForStep(bundle: BackupBundle, step: RestoreStep): BackupRow[];
  /** `remapBackupIds` — every id replaced, every reference followed. */
  remapIds(bundle: BackupBundle): RemapResult;
}

/**
 * A planned Microsoft Money migration: the transform's four collections, as
 * ROWS, with every id minted and every cross-reference resolved.
 *
 * The SIX fields this port reads, and no more. `planCloudImport` answers
 * twenty — the rest belong to the SCOPED re-import (`scripts/mnyReimportPlan.mts`),
 * which keeps a login's bank-feed rows and hands the planner a picture of what
 * survived: `skippedExisting`, `feedPromotionRows`, `openingBalanceMismatches`,
 * `unpromotableHandovers` and their companions are all answers about rows that
 * were ALREADY THERE. A total migration wipes first, so on this path every one
 * of them is empty by construction, and naming them here would be inviting the
 * next reader to wire up a reconciliation that cannot happen.
 *
 * The two PAIRS are the interesting part, and the plan states them twice on
 * purpose: `accounts`/`accountParents` and `transactions`/`transferLinks` +
 * `splitLegPins`. `CloudPlan` puts it exactly right — *"`transferLinks` /
 * `splitLegPins` above say what the links ARE; these say how they are WRITTEN"* —
 * and the two engines want different halves. The cloud wants the second
 * (`linkRows`, `accountParentRows`: complete rows for a batched upsert, because
 * PostgREST has to send whole tuples). A file wants the FIRST, because a backup
 * carries its links as columns on the rows and `buildBackupBundle` reads them
 * off into the `links` payload the restore closes in its own second pass.
 */
export interface MsMoneyPlan {
  /** Account rows, WITHOUT `parent_account_id` — see {@link MsMoneyPlan.accountParents}. */
  accounts: readonly BackupRow[];
  /** Investment↔cash pairings, as the second pass states them. */
  accountParents: ReadonlyArray<{ id: string; parent_account_id: string }>;
  /** Category rows, parents before children. */
  categories: readonly BackupRow[];
  /** Transaction rows, WITHOUT either link column. */
  transactions: readonly BackupRow[];
  /** Each half of a transfer pair, pointing at the other. */
  transferLinks: ReadonlyArray<{ id: string; linked_transfer_id: string }>;
  /** A transfer leg pinned to the split LINE that is its opposite half. */
  splitLegPins: ReadonlyArray<{ id: string; linked_transfer_split_id: string }>;
  /** Split lines, carrying their own `linked_transfer_id` — a backup column. */
  splits: readonly BackupRow[];
}

/**
 * How a .mny file becomes rows, supplied to the port rather than imported by it.
 *
 * ── THE SAME ARGUMENT AS {@link BackupFormat}, MADE ABOUT A SECOND MODULE ────
 *
 * `planCloudImport` is PURE — collections in, rows out, ids from an injected
 * generator — and it is the ONE planner all three engines must share for the
 * reason the format is shared: it is where Money's model is reconciled with the
 * app's, and a second copy would be a second opinion about what a .mny file
 * means. The name says "cloud" because the cloud is what first needed it; the
 * work it does is an engine-independent translation, and this port is the proof.
 *
 * It is not IMPORTED, for the reason the format is not. It used to live in
 * `services/import/msMoney/msMoneyImport.ts`, whose module scope reaches
 * `storageAdapter` (the browser's IndexedDB writer) and `createScopedLogger`
 * (which reaches the cloud's logging service), so a static import here would
 * have dragged both into a desktop bundle — the same refusal PHASE3-PLAN §5's
 * bundle greps make about `backupService.ts`, one module along. Slice 27 lifted
 * the planner into `import/msMoney/cloudPlan.ts`, which reaches neither, and the
 * shell supplies it from there; the injection stays because a port that reached
 * for a .mny planner would be a port with an opinion about Microsoft Money.
 *
 * ── WHERE THE IDS COME FROM, AND WHY THE PORT DOES NOT MINT THEM ────────────
 *
 * `planCloudImport` takes a generator; this method does not, and that is
 * deliberate. The ids a plan mints NEVER REACH THE FILE: `restoreBackup` remaps
 * every one of them through `BackupFormat.remapIds` before a row is sent, which
 * is the app's own rule and the same rule a restore from any other engine's
 * backup gets. So they are internal to the plan, they exist only to make it
 * self-consistent, and the generator belongs to whoever supplies the planner —
 * exactly as `remapIds`'s own generator belongs to whoever supplies the format.
 * This port mints nothing, and that stays true.
 */
export interface MsMoneyMigration {
  /**
   * `planCloudImport(result, owner, newId)` — with `newId` closed over by the
   * supplier, and no options: a total migration lands in a store that has just
   * been wiped, so there is nothing to match onto, nothing to suppress and no
   * bank-feed row to hand a transfer leg over to.
   */
  plan(result: MsMoneyImportResult, owner: string): MsMoneyPlan;
}

/**
 * An open ledger file, as the port needs to see it.
 *
 * Two things and no more: how to ask it questions, and whose rows it holds.
 * Whatever opened the document supplies both — the harness for a spec, the
 * shell's `open_file` for a person.
 */
export interface LocalDocument {
  /** The uuid in the file's one `users` row, read when the document opened. */
  owner: string;
  /** How this document is reached. See {@link CoreTransport}. */
  transport: CoreTransport;
  /** What a backup file looks like. See {@link BackupFormat}. */
  format: BackupFormat;
  /** How a parsed .mny file becomes rows. See {@link MsMoneyMigration}. */
  migration: MsMoneyMigration;
  /**
   * Where a read that could not happen is reported. Structural and injected
   * rather than the app's `createScopedLogger`, which reaches the cloud's
   * logging service: the desktop bundle must be able to answer PHASE3-PLAN §5's
   * "zero supabase" grep, and a logger is not worth failing it for. Defaults to
   * the console, never to silence — a boot that quietly served an empty ledger
   * is the failure this whole family of catches is designed around.
   */
  logger?: { error: (message: string, error: unknown) => void };
}

/** `users.id` must be a lowercase 36-character uuid — `schema.sql`'s CHECK. */
const OWNER_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * What a file on a device can do. Answered from constants, because every one of
 * these is a property of the engine rather than of the data in it, and the seam
 * requires the answer synchronously (`dataPort.ts`: every consumer is a render
 * or the tick of a write).
 */
const DEVICE_CAPABILITIES: DataPortCapabilities = {
  // WORDS ONLY. Nothing branches on this; the four below are what decisions are
  // taken from. See `editionIsCopyOnly.test.ts`, which greps for the breach.
  edition: 'device',
  // Not a degraded 'ready'. The seam blesses this exactly: 'anonymous' is
  // "nobody is signing in… a device edition that has no logins at all", and it
  // is a perfectly good state to work in. 'connecting' would make the screens
  // that start irreversible work refuse forever.
  session: 'anonymous',
  // One file on one machine. Nothing else can change it, so nothing arrives.
  realtime: false,
  // ONE, and the sentence the seam asks for: the desktop holds one connection
  // behind a mutex, which is a QUEUE rather than concurrency. Answering 8 would
  // not make two writes overlap, it would make eight callers wait in a way none
  // of them was told about, and the caller that batched by this number would be
  // sizing its batches against a number that means nothing.
  maxConcurrentWrites: 1,
  // The file IS the only copy. That is a materially different thing to tell
  // somebody before they close the window, and the two backup screens say it
  // from here.
  backupTarget: 'device',
  // EMPTY IS A STATEMENT HERE, not a stub. `schema.sql` holds all fifteen
  // tables a backup file carries — including the three a browser has never had
  // (`investments`, `investment_transactions`, `goal_contributions`) — so a file
  // restored from a login loses nothing at all.
  //
  // This field exists because a screen used to answer that question by reading
  // `LOCAL_BACKUP_BINDINGS`, the browser's own table, chosen by `backupTarget
  // !== 'login'`. A device matches that condition, so `RestoreBackupModal` would
  // have warned somebody that their file's budgets and goals could not be kept —
  // by a file that keeps them. Reading it from the ENGINE is what makes the
  // answer come from the thing being asked about.
  //
  // `restoreBackup` below answers `notStoredLocally: []` for the same reason and
  // from the same fact, and the contract suite asserts the two agree.
  cannotKeep: []
};

/** The two words this port's boot stats are allowed to use. See the header. */
const LOCAL_MODE = 'local mode';
const LOAD_FAILED = 'load failed';

/**
 * The phrase `wipe_user_financial_data` demands before it will do anything.
 *
 * Stated here rather than carried across the seam: see `wipeAllFinancialData`
 * below for why the confirmation belongs to the screen and the phrase belongs
 * to the implementation.
 */
const WIPE_CONFIRMATION = 'DELETE EVERYTHING';

const failedStats = (): BootTransactionStats => ({
  cached: 0,
  fetched: 0,
  total: 0,
  fullFetchReason: LOAD_FAILED
});

/**
 * Rows, with a few more columns on the ones named.
 *
 * A row nobody named is returned AS IT WAS rather than copied, and a column
 * named for a row that is not here is DROPPED rather than invented. The second
 * of those is the one worth stating: `planCloudImport` builds its link lists
 * from every transaction the file offered, including any it decided not to
 * write, so a lookup that missed would otherwise put a link on nothing.
 */
const withColumns = (
  rows: readonly BackupRow[],
  columnsById: ReadonlyMap<string, Readonly<Record<string, string>>>
): BackupRow[] =>
  rows.map(row => {
    const columns = typeof row.id === 'string' ? columnsById.get(row.id) : undefined;
    return columns === undefined ? row : { ...row, ...columns };
  });

export class LocalDataPort implements DataPort {
  readonly #owner: string;

  readonly #transport: CoreTransport;

  readonly #logger: { error: (message: string, error: unknown) => void };

  readonly #format: BackupFormat;

  readonly #migration: MsMoneyMigration;

  constructor(document: LocalDocument) {
    if (!OWNER_SHAPE.test(document.owner)) {
      // R-3, refused where it can still be understood. `schema.sql` would
      // refuse this too — `CHECK (id = lower(id) AND length(id) = 36)` on
      // users — but only on a write, and every read would meanwhile answer
      // with an empty ledger, which reads exactly like a new file.
      throw new Error(
        `A local ledger is owned by the uuid in its own users row, and ${JSON.stringify(
          document.owner
        )} is not one. The file's schema refuses any id that is not 36 lowercase characters.`
      );
    }
    this.#owner = document.owner;
    this.#transport = document.transport;
    this.#format = document.format;
    this.#migration = document.migration;
    this.#logger = document.logger ?? {
      error: (message, error) => {
        console.error(`[LocalDataPort] ${message}`, error);
      }
    };
  }

  /**
   * One verb, asked of this document's owner.
   *
   * The owner is added HERE and only here, which is what makes seam rule 1 a
   * property of the code rather than a habit: there is no method below that
   * could accidentally send someone else's id, because none of them builds a
   * payload with a `user_id` in it.
   */
  async #ask(verb: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return this.#transport.call(verb, { user_id: this.#owner, ...payload });
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async listAccounts(): Promise<Account[]> {
    const answer = await this.#ask('list_accounts');
    return rowsOf(answer, 'list_accounts', 'accounts').map(toAccount);
  }

  async listClosedAccounts(): Promise<Account[]> {
    const answer = await this.#ask('list_closed_accounts');
    return rowsOf(answer, 'list_closed_accounts', 'closed_accounts').map(toAccount);
  }

  async listTransactions(): Promise<Transaction[]> {
    const answer = await this.#ask('list_transactions');
    return rowsOf(answer, 'list_transactions', 'transactions').map(toTransaction);
  }

  /**
   * The boot's transaction read.
   *
   * The same verb `listTransactions` asks, and a different QUESTION: this one
   * is allowed to serve a snapshot and report that it did. A file has no
   * snapshot layer to serve from, so it reports the truth — B-1's `'local
   * mode'`, `cached: 0` — and the rows are the same rows either way.
   *
   * NEVER REJECTS. See the header.
   */
  async loadBootTransactions(): Promise<BootTransactionsResult> {
    try {
      const transactions = await this.listTransactions();
      return {
        transactions,
        stats: {
          cached: 0,
          fetched: transactions.length,
          total: transactions.length,
          fullFetchReason: LOCAL_MODE
        }
      };
    } catch (error) {
      this.#logger.error('The ledger file could not be read for the boot', error);
      return { transactions: [], stats: failedStats() };
    }
  }

  /**
   * Every account's balance, DERIVED by the file.
   *
   * NEVER REJECTS AND NEVER GUESSES: an empty map means "I don't know" and the
   * app sums the rows itself. A map of zeros would be a different answer
   * entirely — the seeding rule keys off the map being non-empty, so zeros
   * would paint every account at £0.00 and present it as real money.
   *
   * B-2 gives the local core 'answers', and the verb behind it is the one place
   * in this engine that computes money rather than reading it: it aggregates,
   * it counts archived rows in (archiving is a view flag and never moves a
   * balance), and it never touches `accounts.balance`. Those properties are the
   * crate's, asserted there; what matters here is that this is a SECOND opinion
   * about a figure the app also computes for itself, and two numbers are only
   * worth having while they are arrived at independently.
   */
  async getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    const balances = new Map<string, AccountBalanceSnapshot>();
    try {
      const answer = await this.#ask('account_balances');
      for (const row of rowsOf(answer, 'account_balances', 'account_balances')) {
        const { accountId, snapshot } = toBalance(row);
        balances.set(accountId, snapshot);
      }
    } catch (error) {
      this.#logger.error('The ledger file could not compute its balances', error);
      return new Map();
    }
    return balances;
  }

  async listTransactionSplits(): Promise<TransactionSplit[]> {
    const answer = await this.#ask('list_transaction_splits');
    return rowsOf(answer, 'list_transaction_splits', 'transaction_splits').map(toSplit);
  }

  async listTransactionSplitsFor(transactionId: string): Promise<TransactionSplit[]> {
    const answer = await this.#ask('splits_for', { transaction_id: transactionId });
    return rowsOf(answer, 'splits_for', 'splits').map(toSplit);
  }

  async listBudgets(): Promise<Budget[]> {
    const answer = await this.#ask('list_budgets');
    return rowsOf(answer, 'list_budgets', 'budgets').map(toBudget);
  }

  async listGoals(): Promise<Goal[]> {
    const answer = await this.#ask('list_goals');
    return rowsOf(answer, 'list_goals', 'goals').map(toGoal);
  }

  /**
   * Every report this file holds, oldest first.
   *
   * Rarely the read that runs: `loadBoot` carries the same list, because two of
   * the readers are synchronous and cannot await one. This exists for the same
   * reason `listGoals` does beside a boot that already answered — the seam
   * declares a read per entity, and a caller that wants only the reports should
   * not have to ask for the whole ledger to get them.
   */
  async listCustomReports(): Promise<CustomReport[]> {
    const answer = await this.#ask('list_custom_reports');
    return rowsOf(answer, 'list_custom_reports', 'custom_reports').map(toCustomReport);
  }

  async listForecastAdjustments(): Promise<ForecastAdjustment[]> {
    const answer = await this.#ask('list_forecast_adjustments');
    return rowsOf(answer, 'list_forecast_adjustments', 'forecast_adjustments')
      .map(toForecastAdjustment);
  }

  async listCategories(): Promise<Category[]> {
    const answer = await this.#ask('list_categories');
    return rowsOf(answer, 'list_categories', 'categories').map(toCategory);
  }

  async listSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    const answer = await this.#ask('list_suggestion_dismissals');
    return rowsOf(answer, 'list_suggestion_dismissals', 'suggestion_dismissals').map(toDismissal);
  }

  // ── The boot, in one crossing ─────────────────────────────────────────────

  /**
   * Everything the app boots with, from ONE snapshot of ONE file.
   *
   * BOOT_COMPOSITION's local-core row is `{ fansOut: false }`, and this method
   * is what makes it true: it does not call the reads above, it asks the
   * `load_boot` verb, which wraps seven reads in one deferred read transaction.
   * The ordering rules the cloud has to KEEP — categories before transactions,
   * budgets and goals together — are not kept here; they are unable to be
   * broken here, which is a stronger property and the reason the contract suite
   * asserts a different shape for this engine.
   *
   * ONE phase, timed here. The cloud names five because it makes five crossings
   * and any one of them can be the slow one; there is one crossing here, so a
   * second name would be an invented breakdown of an indivisible answer. What
   * the six parts cost is measured where measuring means something —
   * `tests/reads_at_scale.rs`, on a fifty-thousand-row ledger.
   *
   * `getAccountBalances` is NOT folded in, and the omission is load-bearing
   * even for a file that could answer instantly: the seeding rule it feeds
   * fires only while `transactions.length === 0`, so an early answer that
   * arrives WITH the transactions is the same as no answer at all.
   *
   * NEVER REJECTS. See the header.
   */
  async loadBoot(): Promise<BootSnapshot> {
    const phases: Record<string, number> = {};
    const started = performance.now();

    const snapshot: BootSnapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transactionStats: failedStats(),
      splits: [],
      budgets: [],
      goals: [],
      customReports: [],
      phases
    };

    try {
      const answer = await this.#ask('load_boot');
      snapshot.accounts = rowsOf(answer, 'load_boot', 'accounts').map(toAccount);
      snapshot.categories = rowsOf(answer, 'load_boot', 'categories').map(toCategory);
      snapshot.transactions = rowsOf(answer, 'load_boot', 'transactions').map(toTransaction);
      // The one key that is not the seam's own name for the field: `splits`
      // here is `transaction_splits` there, because the crate names a read
      // after the question it answers and `splits_for` already owns the bare
      // word for one parent's lines.
      snapshot.splits = rowsOf(answer, 'load_boot', 'transaction_splits').map(toSplit);
      snapshot.budgets = rowsOf(answer, 'load_boot', 'budgets').map(toBudget);
      snapshot.goals = rowsOf(answer, 'load_boot', 'goals').map(toGoal);
      snapshot.customReports = rowsOf(answer, 'load_boot', 'custom_reports').map(toCustomReport);
      snapshot.transactionStats = {
        cached: 0,
        fetched: snapshot.transactions.length,
        total: snapshot.transactions.length,
        fullFetchReason: LOCAL_MODE
      };
    } catch (error) {
      this.#logger.error('The ledger file could not be opened for the boot', error);
    }

    phases.load_boot = Math.round(performance.now() - started);
    return snapshot;
  }

  // ── Account writes ────────────────────────────────────────────────────────

  /**
   * One account, as somebody typed it.
   *
   * ── B-7, AND THE ONE FIELD THE ANSWER CANNOT CARRY ──────────────────────
   *
   * The seam's promise is that a create hands the WHOLE account back, because
   * the caller puts the object straight into app state and the settings modal
   * seeds its form from whatever is there. So the verb answers with the same
   * projection `listAccounts` answers with, read back from storage after the
   * write, and it comes through the same `mapAccountFromDb` — nothing is
   * reconstructed from the request.
   *
   * `creditLimit` is the exception and it is not this port's to fix: no
   * migration has ever created `accounts.credit_limit`, in the cloud or here
   * (`accountMapping.ts` says so and maps it in both directions "for the day the
   * column exists"). The field can only ever arrive from browser storage, and
   * `contract.ts`'s `CREDIT_LIMIT_STORAGE` declares that rather than leaving it
   * to be discovered.
   *
   * ── THE TWO MONEY FIELDS BECOME ONE ─────────────────────────────────────
   *
   * `Omit<Account, 'id'>` carries a balance and an opening balance, and a
   * ledger with no transactions cannot honour two different figures without
   * breaking B-1. `writes.ts` folds them the way the cloud's own writer folds
   * them — `openingBalance || balance || 0` — and the verb has no second money
   * argument to send the loser to. `ACCOUNT_BALANCE_AT_BIRTH` declares it.
   */
  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const answer = await this.#ask('create_account', toAccountCreatePayload(account));
    return toAccount(rowOf(answer, 'create_account', 'answer'));
  }

  /**
   * A partial edit of an account.
   *
   * The patch is passed through WHOLE rather than filtered, for the reason
   * `updateTransaction` gives above and `writes.ts` argues at length: an engine
   * that refuses a field it does not recognise can only refuse what it is shown.
   * Here that matches the cloud rather than diverging from it —
   * `mapAccountToDb` sends an unmapped field under its own name and PostgREST
   * refuses the whole update, because there is no such column.
   *
   * The field worth naming is `balance`. `AccountUpdate` is a
   * `Partial<Account>`, so a caller can state one, and the cloud will WRITE it —
   * an absolute balance setter, unaudited, with no transaction to justify the
   * figure. It crosses this seam unchanged and the verb refuses it by name.
   */
  async updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    const answer = await this.#ask('update_account', {
      id,
      patch: toAccountUpdatePatch(updates)
    });
    return toAccount(rowOf(answer, 'update_account', 'answer'));
  }

  /**
   * Close an account, which is a soft close in every implementation.
   *
   * The seam is explicit: *"the account leaves the live list and its
   * transactions stay exactly where they are. Nothing in this seam hard-deletes
   * an account, because a deleted account is a hole in a ledger."* One column
   * moves, and the account's To/From category follows it out of the transaction
   * dropdowns — C-4, done by the file's own trigger, so it cannot be forgotten
   * by a caller and cannot be done twice.
   *
   * Answers `void`, and the verb answers with the closed row anyway. Discarded
   * here rather than widened into the seam: `closeAccount` is called by a screen
   * that re-reads both account lists, and a return value nobody reads is a
   * return value that will one day be read wrongly.
   */
  async closeAccount(id: string): Promise<void> {
    await this.#ask('close_account', { id });
  }

  // ── Transaction writes ────────────────────────────────────────────────────

  /**
   * One row, typed by a person.
   *
   * The draft is FILTERED to the verb's own arguments (`writes.ts`'s
   * `CREATE_KEYS`), which reproduces what `create_transaction_atomic` does with
   * the same object: it reads the keys it knows out of a jsonb blob and ignores
   * the rest. `Omit<Transaction, 'id'>` carries `isSplit`, `archived` and a
   * handful of others that this verb has no argument for, and a port that sent
   * them would turn every ordinary create into a refusal.
   *
   * Born reviewed, and the absence is where that happens: the verb has no
   * `needs_review` argument, so the column's own default (`0`) answers, which is
   * the rule `20260810090000` states — *"a row the user typed into the Quick Add
   * bar or the full editor is born reviewed; they were looking at it as they
   * made it"*.
   */
  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const answer = await this.#ask('create_transaction', toCreatePayload(transaction));
    return toTransaction(rowOf(answer, 'create_transaction', 'transaction'));
  }

  /**
   * A partial edit of the fields a row's own editor owns.
   *
   * The patch is passed through WHOLE rather than filtered — see `writes.ts` for
   * why the create and the update make opposite decisions about a key the verb
   * has not heard of. In one sentence: D-7 gives this engine 'refuses', and it
   * can only refuse what it is shown.
   */
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const answer = await this.#ask('update_transaction', {
      id,
      patch: toUpdatePatch(updates)
    });
    return toTransaction(rowOf(answer, 'update_transaction', 'transaction'));
  }

  /**
   * Remove one row, and reverse its account by exactly its amount.
   *
   * The seam's two promises beyond the delete itself are the FILE's here rather
   * than this method's, which is why there is nothing to do about either: the
   * survivor of a linked pair is unlinked by
   * `transactions_linked_transfer_id_fkey`'s ON DELETE SET NULL, and a dismissed
   * suggestion about the row is pruned by the schema's own AFTER DELETE trigger.
   * Both are stated in `schema.sql` and both are asserted through this operation
   * by the contract suite, so a schema that lost either would fail here rather
   * than in a register offering to jump to a transaction that is gone.
   */
  async deleteTransaction(id: string): Promise<void> {
    await this.#ask('delete_transaction', { id });
  }

  /**
   * File a category on the rows of a payee that are still blank.
   *
   * Fill-blanks only, and it leaves `needsReview` exactly as it was. The
   * contrast with `confirmTransactionCategories` below is the point and it is
   * the crate's, not this file's: this is a decision about a CATEGORY taken from
   * a list of payees, where the rows' dates, amounts and accounts were never on
   * screen, so one run of the bulk tool must not mark a whole imported statement
   * as dealt with.
   */
  async applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    const answer = await this.#ask('apply_category_to_uncategorized', { ids, category });
    return countOf(answer, 'apply_category_to_uncategorized', 'applied');
  }

  /**
   * Agree with the suggested category on a set of rows — and end their review
   * with it, because answering the question a row was asking IS reviewing it.
   */
  async confirmTransactionCategories(ids: string[]): Promise<number> {
    const answer = await this.#ask('confirm_transaction_categories', { ids });
    return countOf(answer, 'confirm_transaction_categories', 'confirmed');
  }

  // ── Marking, committing, and hiding ───────────────────────────────────────

  /**
   * Tick rows off against a statement, or take the tick back.
   *
   * A MARK IS NOT A RECONCILIATION. This is Microsoft Money's C — a working
   * flag, persisted immediately so eight hundred ticks survive walking away from
   * the screen, and settling nothing on its own. The seam says the rule about
   * the committed flag that travels with it — marking LEAVES it alone, unmarking
   * CLEARS it — and the verb keeps it in the same statement, which is what stops
   * the file's own `transactions_reconciled_implies_cleared` from refusing an
   * untick.
   *
   * The count is the verb's `changed` rather than the length of the list: a row
   * already in the requested state is not written and not counted, which is what
   * makes a re-tick free.
   */
  async setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    const answer = await this.#ask('set_transactions_cleared', { ids, cleared });
    return countOf(answer, 'set_transactions_cleared', 'changed');
  }

  /**
   * Finish a reconciliation: commit this account's marked rows and record the
   * day and the ending balance they were settled against, in one transaction.
   *
   * ── WHAT CROSSES, AND IN WHAT SHAPE ─────────────────────────────────────
   *
   * `endingBalance` is a number on this side of the seam and a decimal STRING on
   * the wire, through the same `money` encoder every other figure uses — never
   * `toFixed(2)` and never `* 100`. £0.00 is a real statement balance and the
   * verb refuses an ABSENT one by name, so a caller can tell "settled at zero"
   * from "settled against nothing".
   *
   * `reconciledOn` is a `Date` here and a calendar day on the wire — divergence
   * D-9, and this engine's answer to it is the UTC day, which is what `asDay`
   * takes.
   *
   * ── THE OUTCOME IS THE VERB'S, NOT THE CALLER'S ─────────────────────────
   *
   * All three fields come back from the answer rather than being echoed from the
   * arguments. `reconciled` is the number of rows this call converted — not how
   * many were ticked, and not how many the account holds — because the screen
   * reports it and "Reconciliation complete" with no number is the sentence the
   * old flow ended on.
   */
  async finalizeReconciliation(
    accountId: string,
    endingBalance: number,
    reconciledOn: Date
  ): Promise<ReconciliationOutcome> {
    const answer = await this.#ask('finalize_reconciliation', {
      account_id: accountId,
      ending_balance: encode('money', endingBalance),
      reconciled_on: encode('day', reconciledOn)
    });
    const result = rowOf(answer, 'finalize_reconciliation', 'answer');
    return {
      reconciled: countOf(result, 'finalize_reconciliation', 'reconciled'),
      endingBalance: moneyOr(field(result, 'ending_balance'), endingBalance),
      reconciledOn: day(field(result, 'reconciled_on')) ?? reconciledOn
    };
  }

  /**
   * Hide ONE row from the live register, or bring it back.
   *
   * Never a delete: the row stays in the file, stays counted in the account's
   * balance and in every report, and is hidden only from the register. The verb
   * is the RPC's plural `set_transactions_archived` and the seam's operation is
   * singular, so the narrowing happens here — one id in an array of one.
   *
   * Answers `void`, and the verb answers with a count anyway. Discarded here for
   * `closeAccount`'s reason: an id nobody has is a REFUSAL rather than a zero
   * (this verb is the one in its family that raises), so there is no outcome a
   * caller could learn from the number that it does not already have from the
   * absence of a rejection.
   */
  async setTransactionArchived(id: string, archived: boolean): Promise<void> {
    await this.#ask('set_transactions_archived', { ids: [id], archived });
  }

  /**
   * Archive an account's committed rows up to and including a cutoff day, and
   * stamp the account with it.
   *
   * Only COMMITTED rows are hidden — marked-but-not-committed is work in
   * progress and stays in the register where it can still be unmarked — with the
   * pre-split fallback the cloud keeps: a row whose commitment was never
   * answered is judged by its mark, exactly as the archive judged it before the
   * two flags were separated.
   *
   * **Divergence D-8**: the cutoff is a `Date` here and a calendar day on the
   * wire, and which day an instant belongs to is answered differently per
   * engine. This one takes the UTC day.
   */
  async archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number> {
    const answer = await this.#ask('archive_transactions_before', {
      account_id: accountId,
      cutoff: encode('day', cutoff)
    });
    const result = rowOf(answer, 'archive_transactions_before', 'answer');
    return countOf(result, 'archive_transactions_before', 'archived');
  }

  /**
   * Bring an account's archived rows back into the register, and forget its
   * cutoff.
   *
   * One click, because nothing ever left. It answers zero rather than refusing
   * for an account this owner has not got — the verb has no refusal at all, and
   * that is the RPC's shape rather than an omission in the port; the verb's own
   * documentation traces it.
   */
  async unarchiveAccount(accountId: string): Promise<number> {
    const answer = await this.#ask('unarchive_account', { account_id: accountId });
    const result = rowOf(answer, 'unarchive_account', 'answer');
    return countOf(result, 'unarchive_account', 'unarchived');
  }

  // ── A file's worth of rows ────────────────────────────────────────────────

  /**
   * Add a statement to ONE account, atomically.
   *
   * ── IT REPORTS RATHER THAN THROWS ───────────────────────────────────────
   *
   * The one write on this port with a catch around it, and the seam is explicit
   * about why: *"412 of 900 landed" is an outcome a caller has to render rather
   * than a failure it can retry blindly*. Both importers slice the array they
   * handed in at `inserted` and show the remainder as the payments that are
   * missing, so a rejection would turn a useful screen into "Import failed" and
   * nothing else. The engine's own sentence rides out in `error`, unchanged,
   * because the caller prints it.
   *
   * ── B-9, AND THE TWO SILENCES IT DECLARES ───────────────────────────────
   *
   * `inserted` is a PREFIX count and here it can only be 0 or all of them: one
   * verb, one SQLite transaction, so there is no chunk boundary to stop at.
   * Both are prefixes, which is what the callers actually depend on.
   *
   * `onProgress` is never called, and that is declared rather than approximated
   * — one atomic write has no honest fraction, and a bar creeping to 90% is how
   * somebody waits on a write that already failed. `options.source` is likewise
   * not used: it says the rows carry the bank's own transaction ids, which the
   * cloud keys its chunks by so a re-post cannot land twice. A single atomic
   * write cannot half-land, so there is nothing here for a key to protect, and
   * `alreadyPresent` is 0 — *"a statement rather than a stub"*, in the seam's
   * own words. (The verb behind this does support `import_source`, so honouring
   * it is a decision waiting for a caller rather than a gap in the crate.)
   */
  async importTransactions(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>
  ): Promise<BulkImportResult> {
    const total = transactions.length;
    try {
      const answer = await this.#ask('import_transactions', {
        account_id: accountId,
        rows: transactions.map(toImportRow)
      });
      const result = rowOf(answer, 'import_transactions', 'answer');
      // The two counts mean different things on the two sides of this
      // boundary. The verb's `skipped` is "this login already held a row under
      // that import id"; the seam's `alreadyPresent` is the same rows, and its
      // `inserted` is everything now IN THE ACCOUNT — written by this run or
      // already there under this run's own key. So the seam's inserted is the
      // verb's two counts together, and `alreadyPresent` is a subset of it,
      // which is exactly what the contract asserts.
      const written = countOf(result, 'import_transactions', 'inserted');
      const alreadyPresent = countOf(result, 'import_transactions', 'skipped');
      const inserted = written + alreadyPresent;
      return { inserted, alreadyPresent, total, complete: inserted === total };
    } catch (error) {
      return {
        inserted: 0,
        alreadyPresent: 0,
        total,
        complete: false,
        // The ledger's own prose, or the transport's fault sentence — either
        // way it is already written for a person (seam rule 4), so it is not
        // prefixed or re-worded on the way to the screen.
        error: error instanceof Error ? error.message : 'The import could not be written.'
      };
    }
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  /**
   * Join two existing rows as the two halves of one transfer.
   *
   * Balance-neutral: no amount moves, only the link and the categories that name
   * each side. The crate answers with `transaction` and `other_side` — the house
   * key every result carries, plus a name that says what it is rather than which
   * argument it was — and the seam's `{a, b}` is those two in the order they
   * were asked for.
   */
  async linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    const answer = await this.#ask('link_transfer_pair', { id_a: idA, id_b: idB });
    return {
      a: toTransaction(rowOf(answer, 'link_transfer_pair', 'transaction')),
      b: toTransaction(rowOf(answer, 'link_transfer_pair', 'other_side'))
    };
  }

  /** Join one LINE of a split to an existing row; amounts are compared against the line. */
  async linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    const answer = await this.#ask('link_split_line_transfer', {
      split_id: splitId,
      transaction_id: transactionId
    });
    return {
      split: toSplit(rowOf(answer, 'link_split_line_transfer', 'split')),
      transaction: toTransaction(rowOf(answer, 'link_split_line_transfer', 'transaction'))
    };
  }

  /**
   * Break the links on the named rows, and count the ones that really broke.
   *
   * `clear_transfer_links` rather than a table update, because that is what the
   * client's `clearTransferLinks` has actually called since `20260805145035`.
   * The count is rows ACTUALLY unlinked: a row already unlinked, and a row whose
   * link lives on a split line, are both skipped without a write and neither is
   * counted — the line owns that link, and clearing it here would leave the line
   * pointing at nothing.
   */
  async unlinkTransfers(ids: string[]): Promise<number> {
    const answer = await this.#ask('clear_transfer_links', { ids });
    return countOf(answer, 'clear_transfer_links', 'unlinked');
  }

  /** Re-pair a counterpart onto the row that really matches it. Three rows, one transaction. */
  async repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    const answer = await this.#ask('repair_claimed_transfer', {
      stranded_id: strandedId,
      counterpart_id: counterpartId,
      partner_id: partnerId,
      adjustment_category_id: adjustmentCategoryId
    });
    return {
      stranded: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'transaction')),
      counterpart: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'counterpart')),
      partner: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'partner'))
    };
  }

  /**
   * Make the other side of a transfer in the target account, and link it.
   *
   * The one verb in the transfer family that moves money — it mints a row in
   * another account's register, so that account moves by the new row's amount
   * and the source does not, because the source row's amount is unchanged. Net
   * worth is the same afterwards, which is what makes it a transfer rather than
   * income appearing from nowhere.
   */
  async createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    const answer = await this.#ask('create_transfer_counterpart', {
      id,
      target_account_id: targetAccountId
    });
    return {
      source: toTransaction(rowOf(answer, 'create_transfer_counterpart', 'transaction')),
      counterpart: toTransaction(rowOf(answer, 'create_transfer_counterpart', 'counterpart'))
    };
  }

  /**
   * Point an existing linked transfer at a different account.
   *
   * ── THE CROSSOVER, AND WHY NOTHING HERE COMPUTES IT ─────────────────────
   *
   * Each row's category names the OTHER side, and both are DERIVED from the
   * pairing as it will be rather than patched — because the source's own account
   * can move in the same save, and then the counterpart's category is stale too.
   * The rule is written once in TypeScript (`utils/transferRepoint.ts`, which
   * the browser mirror reads), once in the RPC and once in the verb, and all
   * three derive. This port sends two ids and a word and reads back two rows as
   * the file wrote them: a caller that guessed at the categories a re-file
   * produced is a caller that will one day show a register disagreeing with the
   * ledger.
   *
   * ── THE ONE FIELD THAT IS NOT SENT WHEN THE CALLER SAYS NOTHING ─────────
   *
   * `disposition` is OMITTED rather than defaulted here. `move` is the verb's
   * own default (`p_disposition text DEFAULT 'move'`), and a port that spelled
   * it would be a second place for that default to be decided — the day the
   * three dispositions become four, or the default moves, the two spellings
   * disagree and only one of them is the schema's.
   *
   * ── IT DOES NOT TOUCH EITHER RECONCILIATION FLAG ────────────────────────
   *
   * A re-point is a change of address, not of fact: amounts, dates,
   * descriptions, notes, tags, the mark and the commitment all survive it
   * untouched. That matters most for a committed row, because the file's
   * `transactions_reconciled_implies_cleared` and its archive sweep both watch
   * those flags — and neither is reachable from an operation that never writes
   * one. The verb proves it behaviourally rather than claiming it.
   */
  async repointTransfer(
    id: string,
    targetAccountId: string,
    disposition?: TransferDisplacedDisposition
  ): Promise<TransferRepointResult> {
    const answer = await this.#ask('repoint_transfer', {
      id,
      target_account_id: targetAccountId,
      ...(disposition === undefined ? {} : { disposition })
    });
    return {
      source: toTransaction(rowOf(answer, 'repoint_transfer', 'transaction')),
      counterpart: toTransaction(rowOf(answer, 'repoint_transfer', 'counterpart')),
      displaced: toDisplaced(field(answer, 'displaced'))
    };
  }

  // ── Splits ────────────────────────────────────────────────────────────────

  /**
   * Replace a transaction's split lines, all or nothing.
   *
   * `set_transaction_splits_with_legs` and never the older
   * `set_transaction_splits`, for both kinds of payload. The seam says the
   * choice between server paths *"is the implementation's decision, not the
   * caller's"*, and the cloud makes it per call because both functions exist
   * there; only one was ported, because the with-legs writer is a strict
   * superset — it matches lines by id, so an ordinary line beside a transfer leg
   * can be re-filed, and a plain replace is what it does when no line declares a
   * target.
   *
   * `expectedAmount` is OMITTED when the caller passes null rather than sent as
   * one. Absent is the verb's "do not check", which is the cloud's
   * `p_expected_amount IS NOT NULL` guard; a JSON null would be a caller stating
   * an amount of nothing.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: MoneyNumber | null
  ): Promise<SplitWriteResult> {
    const answer = await this.#ask('set_transaction_splits_with_legs', {
      id: transactionId,
      splits: splits.map(toSplitLine),
      ...(expectedAmount === null ? {} : { expected_amount: String(expectedAmount) })
    });
    return {
      isSplit: field(answer, 'is_split') === true,
      splitCount: countOf(answer, 'set_transaction_splits_with_legs', 'split_count'),
      // The parent's total as the WRITE computed it, which is the figure the
      // caller moves its own balance by. `?? 0` is unreachable for an answer
      // this crate produced (the field is a `Money`, never absent) and says
      // "nothing" rather than throwing if it ever is.
      amount: money(field(answer, 'amount')) ?? 0,
      // Real rows in other accounts — the lines that BECAME transfer legs in
      // this write. The caller updates those accounts' balances from them
      // rather than guessing, which is why an empty list and a missing key are
      // not the same answer and `listOf` refuses the second.
      counterparts: listOf(answer, 'set_transaction_splits_with_legs', 'counterparts').map(
        toTransaction
      )
    };
  }

  // ── Budgets and goals ─────────────────────────────────────────────────────

  /**
   * A limit somebody set on a category, for a period.
   *
   * ── B-3, AND WHAT "THE DEVICE ITSELF" MEANS HERE ────────────────────────
   *
   * The divergence table gives this engine *'the device itself'* as its owner,
   * against the cloud's *'an owner the implementation resolves, stamped on the
   * row and enforced by RLS'* — and the two rules underneath that phrase are
   * asserted equal for every engine. Both are structural here rather than
   * careful:
   *
   *   NO OPERATION ACCEPTS AN OWNER. This method takes one argument, as the
   *   contract suite checks by arity, and there is nowhere to put a second: the
   *   owner is added by `#ask` and by nothing else, so no method on this class
   *   can send somebody else's.
   *
   *   A WRITE WHOSE OWNER COULD NOT BE RESOLVED DOES NOT REACH ANOTHER OWNER'S
   *   STORE. There is no unresolved owner to have: the port is constructed with
   *   the open document's, its shape is checked at construction (R-3), and two
   *   documents are two FILES. The hazard the seam describes at length —
   *   `PlanningService.createBudget(null, …)` quietly writing the browser's copy
   *   and losing the budget by morning — has no analogue on a device, and this
   *   is why: there is one store and one owner, decided when the file opened.
   *
   * `spent` is not sent and the verb has no argument for it. What has been spent
   * against a category is summed from the ledger, so a new budget starts at zero
   * in every implementation, and `writes.ts` leaves the key out rather than
   * sending a figure the verb would discard.
   *
   * TWO COLUMNS ARE FILLED IN BY THE VERB, not here: `start_date` defaults to
   * today and `name` to the category id (or the literal 'Budget'). Both are
   * `NOT NULL` in the file and both are lines of the cloud's own writer, so they
   * live where the differential harness can compare them.
   */
  async createBudget(budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    const answer = await this.#ask('create_budget', toBudgetCreatePayload(budget));
    return toBudget(rowOf(answer, 'create_budget', 'answer'));
  }

  /**
   * Change a budget, and hand back the whole budget as it now stands.
   *
   * A budget that is not there is refused BY NAME and the store is left exactly
   * as it was — the verb reads the row before its first write. That is the port
   * of one word in the cloud's query, `.single()`, and `deleteBudget` below has
   * no such clause and is therefore a successful nothing on the same id.
   *
   * ONE EDIT DOES MORE THAN IT SAYS, and it is the cloud's behaviour rather than
   * this port's: moving a budget to a different category also renames it to that
   * category's id, because `budgetToDb` writes `name` whenever EITHER key is
   * present. The verb reproduces it and a spec pins it; a port that tidied it
   * would leave the two editions disagreeing about what a budget is called.
   */
  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const answer = await this.#ask('update_budget', {
      id,
      patch: toBudgetUpdatePatch(updates)
    });
    return toBudget(rowOf(answer, 'update_budget', 'answer'));
  }

  /**
   * Remove a budget — a real delete, which an account never gets.
   *
   * The seam gives the reason: a budget holds no money and nothing is filed
   * against it, so removing one leaves no hole in the ledger. Removing one that
   * is already gone is a NO-OP rather than an error, which is the same rule
   * `dismissSuggestion` keeps and is the case a slow network actually produces.
   *
   * Answers `void`, and the verb answers with a count anyway. Discarded here for
   * `closeAccount`'s reason: a return value nobody reads is a return value that
   * will one day be read wrongly.
   */
  async deleteBudget(id: string): Promise<void> {
    await this.#ask('delete_budget', { id });
  }

  /**
   * A target, a date to reach it by, and how much has been put by so far.
   *
   * ── THE OPENING FIGURE (rule 49) ────────────────────────────────────────
   *
   * `progress` is not an argument and is not ignored either: it is DERIVED from
   * `currentAmount`, so a goal written down for something already half saved for
   * begins there. The two app fields are one column, `writes.ts` folds them the
   * way the cloud's own writer folds them, and a goal with nothing put by starts
   * at zero because the COLUMN defaults to zero — not because anything here
   * writes one. The version that hard-coded zero lost the opening amount, and
   * lost it differently in each engine.
   *
   * B-3 applies word for word: see `createBudget` above.
   */
  async createGoal(goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> {
    const answer = await this.#ask('create_goal', toGoalCreatePayload(goal));
    return toGoal(rowOf(answer, 'create_goal', 'answer'));
  }

  /**
   * Change a goal, and hand back the whole goal as it now stands.
   *
   * ALSO THE CONTRIBUTION PATH. Money put towards a goal arrives here as an
   * ordinary update carrying the new `progress` — already summed and already
   * capped against the target by the caller — so the verb SETS the column and
   * never adds to it. `writes.ts` gives `progress` precedence over
   * `currentAmount`, which is the order the cloud's mapper tests them in and the
   * order the contribution actually arrives with.
   *
   * A goal that is not there is refused by name, and the store is left exactly
   * as it was.
   *
   * THE THREE FIELDS WITH NO COLUMNS — `type`, `linkedAccountIds`,
   * `contributionAmount` — travel as a `metadata` object and are MERGED over
   * what is stored, inside the write's own transaction. The merge is the verb's
   * rather than this port's on purpose: merging here would merge over whatever
   * this caller last read, which is precisely how editing a goal's type came to
   * delete its linked accounts.
   */
  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const answer = await this.#ask('update_goal', {
      id,
      patch: toGoalUpdatePatch(updates)
    });
    return toGoal(rowOf(answer, 'update_goal', 'answer'));
  }

  /**
   * Remove a goal, and the contributions filed against it.
   *
   * The cascade is the FILE's — `goal_contributions.goal_id` is `ON DELETE
   * CASCADE` in both schemas — and the verb deliberately does not walk it, which
   * is the opposite of `deleteCategory`'s decision about ITS cascade. The verb's
   * own documentation argues the three differences; the short version is that a
   * contribution is a different entity from the thing being deleted, so counting
   * or auditing it would make one number mean two things.
   *
   * What this does NOT do is forget the goal's trophy: the achievement record
   * belongs to the caller that owns the celebration, and a store is not the
   * place to put the rule about what a completed goal feels like.
   *
   * Removing one that is already gone is a no-op, not an error.
   */
  async deleteGoal(id: string): Promise<void> {
    await this.#ask('delete_goal', { id });
  }

  // ── Custom reports ────────────────────────────────────────────────────────
  //
  // The one entity here that a device edition WAS ALREADY LOSING before it
  // arrived. Every other family on this seam had a home in the ledger file from
  // the day the schema was written; a custom report's only home was the
  // WebView's `localStorage`, which is not in the file, does not travel with it,
  // and is thrown away by anything that clears the app's data. Somebody could
  // copy their ledger to a new machine, open it, and find their reports gone —
  // the same failure `preferencesTransport.ts` opens by describing, one entity
  // along and with the same answer: *"a file that holds the money and not the
  // choices is a file that is only half a backup."*

  /**
   * Save a report somebody built.
   *
   * B-3 applies word for word: see `createBudget` above. There is no per-call
   * owner to get wrong — `#ask` adds the document's, and two owners are two
   * FILES.
   *
   * The two timestamps do NOT travel, exactly as they do not on the create
   * beside it: the verb's draft has five fields and none of them is a clock.
   * `writes.ts` records what that costs the adoption path, which is the only
   * caller that had a date worth keeping.
   */
  async createCustomReport(report: Omit<CustomReport, 'id'>): Promise<CustomReport> {
    const answer = await this.#ask('create_custom_report', toCustomReportCreatePayload(report));
    return toCustomReport(rowOf(answer, 'create_custom_report', 'answer'));
  }

  /**
   * Change a report, and hand back the whole report as it now stands.
   *
   * A report that is not there is refused BY NAME and the store is left exactly
   * as it was — `.single()`'s behaviour in the cloud, the verb's own read-before-
   * write here, and the same rule the budget and goal updates keep.
   *
   * `components` and `filters` REPLACE. That is the one line of this method that
   * is not inherited from the planning writes beside it, and it is the opposite
   * of what `updateGoal` above does with `metadata`: a goal's blob is merged
   * inside the verb's transaction because three unrelated fields share it, and a
   * report's two blobs are each the whole of what they describe. An engine that
   * merged them would make removing a component impossible — the removed one
   * would come back on every save, and nothing on screen would say why.
   */
  async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    const answer = await this.#ask('update_custom_report', {
      id,
      patch: toCustomReportUpdatePatch(updates)
    });
    return toCustomReport(rowOf(answer, 'update_custom_report', 'answer'));
  }

  /**
   * Remove a report.
   *
   * A real delete, like a budget's: nothing is filed against a report and no
   * balance is derived from one. Removing one that is already gone is a no-op,
   * not an error.
   *
   * Answers `void`, and the verb answers with a count anyway — discarded here
   * for `deleteBudget`'s reason: a return value nobody reads is a return value
   * that will one day be read wrongly.
   */
  async deleteCustomReport(id: string): Promise<void> {
    await this.#ask('delete_custom_report', { id });
  }

  /**
   * The scenario pair. The figure crosses as the integer of pennies it is in
   * both stores — the one money field in this file with no scale conversion
   * anywhere on its trip. A category the file does not hold is refused by
   * its own foreign key, surfaced as the crate's constraint refusal.
   */
  async setForecastAdjustment(categoryId: string, monthlyMinor: number): Promise<ForecastAdjustment> {
    const answer = await this.#ask('set_forecast_adjustment', {
      category_id: categoryId,
      monthly_minor: monthlyMinor
    });
    return toForecastAdjustment(rowOf(answer, 'set_forecast_adjustment', 'answer'));
  }

  async clearForecastAdjustment(categoryId: string): Promise<void> {
    await this.#ask('clear_forecast_adjustment', { category_id: categoryId });
  }

  // ── Holdings ──────────────────────────────────────────────────────────────
  //
  // The last region of the ledger to reach this file, and the one that arrived
  // with a SECOND fixed-point scale. Everything else here crosses money as a
  // two-place decimal string read once by `values.money`; a holding's quantity
  // and its two unit prices cross at EIGHT places and are never turned into a
  // `number` at all — `DataPortInvestmentWrites` argues why, and the short
  // version is that a share price is a rate rather than an amount, and
  // `numeric(10,2)` rounding one to £32.78 invented half a penny a share every
  // night until migration 20260809120000.
  //
  // The read comes back through the CLOUD's own `toHolding` (see `holding.ts`),
  // which is the arrangement `toAccount` already has: not another interpretation
  // of a column table, literally the same function the signed-in page uses.
  // Which is possible because the crate's `list_investments` answers with the
  // cloud's own `SELECTED_COLUMNS` — the two engines hand that mapper the same
  // keys, differing only in whether a figure arrives as text or as a JSON
  // number, and it accepts either through `Decimal` in both cases.

  /**
   * Every position this file holds, by symbol.
   *
   * B-12's other branch: this engine HAS somewhere to keep them, so an empty
   * answer here means an empty portfolio, and `capabilities().cannotKeep` is
   * empty to say so.
   */
  async listInvestments(): Promise<InvestmentHolding[]> {
    const answer = await this.#ask('list_investments');
    return toHoldings(rowsOf(answer, 'list_investments', 'investments'));
  }

  /**
   * Record a position.
   *
   * `cost_basis` IS NOT SENT and there is no key for one: the verb derives it
   * from `quantity × purchase_price` in i128 and rounds it half-away-from-zero,
   * which is what `numeric(10,2)` does to the product the cloud's writer
   * computes with `Decimal`. Two engines, one figure, and no caller able to
   * state a cost that contradicts the position.
   *
   * B-3 applies word for word: see `createBudget` above.
   */
  async createInvestment(draft: InvestmentDraft): Promise<InvestmentHolding> {
    const answer = await this.#ask('create_investment', toInvestmentCreatePayload(draft));
    return this.#holding('create_investment', answer);
  }

  /**
   * Change a position, and hand back the whole holding as it now stands.
   *
   * QUANTITY AND UNIT COST MOVE THE COST TOGETHER. The verb reads the stored row
   * INSIDE the transaction that writes, so the half the patch did not state
   * comes from the file rather than from whatever this caller last read — the
   * cloud's second round trip without its race, and the same reason
   * `updateGoal`'s metadata merge lives in the verb rather than here.
   *
   * A holding that is not there is refused by name, and the store is left
   * exactly as it was.
   */
  async updateInvestment(id: string, changes: InvestmentChanges): Promise<InvestmentHolding> {
    const answer = await this.#ask('update_investment', {
      id,
      patch: toInvestmentUpdatePatch(changes)
    });
    return this.#holding('update_investment', answer);
  }

  /**
   * Remove a position, and the buys and sells filed against it.
   *
   * The cascade is the FILE's — `investment_transactions.investment_id` is `ON
   * DELETE CASCADE` in both schemas — and the verb deliberately does not walk
   * it, which is `deleteGoal`'s decision about contributions and is argued at
   * the verb.
   *
   * Removing one that is already gone is a no-op, not an error.
   */
  async deleteInvestment(id: string): Promise<void> {
    await this.#ask('delete_investment', { id });
  }

  /**
   * Write fetched prices onto the rows they are about.
   *
   * ONE CROSSING WHERE THE CLOUD MAKES N. `InvestmentService.applyQuotes` loops
   * a PostgREST update per quote; this sends the list and the verb writes them
   * in one transaction. What the seam compares is the PROMISE — the rows carry
   * the prices, the count is rows repriced and never quotes offered — and the
   * differential spec drives both engines from the same list.
   *
   * Nothing in, zero out, and the file is not opened for it: the check is here
   * as well as in the verb because the seam says an empty sweep is the ordinary
   * case, and a crossing that does nothing is still a crossing.
   */
  async applyInvestmentPrices(quotes: readonly QuoteWriteback[]): Promise<number> {
    if (quotes.length === 0) return 0;
    const answer = await this.#ask('apply_investment_prices', {
      quotes: quotes.map(quote => ({
        symbol: quote.symbol,
        price: quote.price,
        as_of: quote.asOf
      }))
    });
    return countOf(field(answer, 'answer'), 'apply_investment_prices', 'repriced');
  }

  async listInvestmentPrices(): Promise<Array<{ date: string; price: string; source: 'quote' | 'manual' | 'trade' | 'import' }>> {
    // No price table in the ledger file yet (see importInvestmentPriceHistory
    // below). An empty series is the honest READ answer — the register then
    // shows the buy line alone, which is true of what this file knows.
    return [];
  }

  async recordInvestmentPrice(): Promise<void> {
    throw new Error(
      'This ledger file cannot hold price history yet. Revalue in the cloud edition for now.'
    );
  }

  async importInvestmentPriceHistory(): Promise<number> {
    // The ledger file has no price-history table yet — that is a schema and a
    // verb in the core, its own gated lane. The UI never offers this door on
    // the device edition (CHROME_HAS_PRICE_HISTORY is false), so this
    // refusal is the belt under that brace, with a sentence rather than a
    // crash for whoever reaches it anyway.
    throw new Error(
      'This ledger file cannot hold price history yet. Import it in the cloud edition for now.'
    );
  }

  async listInvestmentEvents(): Promise<InvestmentEvent[]> {
    // No events table in the ledger file yet — same lane as price history.
    // An empty history is the honest READ answer: this file records no
    // trades, and the UI never offers the doors that would show them
    // (CHROME_HAS_PRICE_HISTORY is false).
    return [];
  }

  async importInvestmentEvents(): Promise<number> {
    throw new Error(
      'This ledger file cannot hold trading history yet. Import it in the cloud edition for now.'
    );
  }

  async listAllInvestmentEvents(): Promise<InvestmentEvent[]> {
    // Same honest empty as the per-account read: this file records no trades,
    // so the device's net worth stays pure ledger — unchanged and true.
    return [];
  }

  async recordInvestmentEvent(): Promise<void> {
    throw new Error(
      'This ledger file cannot hold trading history yet. Record the trade in the cloud edition for now.'
    );
  }

  async recordTradePrices(): Promise<number> {
    throw new Error(
      'This ledger file cannot hold price history yet. Record it in the cloud edition for now.'
    );
  }

  async deleteInvestmentEvents(): Promise<void> {
    // An empty history has nothing to erase; deleting a holding proceeds.
  }

  async moveInvestmentEventDate(): Promise<{ previousDate: string }> {
    throw new Error(
      'This ledger file cannot hold trading history yet. Move the trade in the cloud edition for now.'
    );
  }

  async listAllInvestmentPrices(): Promise<
    Array<{ symbol: string; date: string; price: string; currency: string }>
  > {
    return [];
  }

  /**
   * A write verb's answer as the app's holding.
   *
   * `toHolding` returns `null` for a row it cannot read — no symbol, no quantity
   * — and here that can only mean the file answered something this port does not
   * understand. A null passed on would be a holding that vanished from the page
   * after a save the user watched succeed, so it is a fault with a sentence on
   * it instead, exactly as `rowOf` and `countOf` are for the same reason.
   */
  #holding(verb: string, answer: unknown): InvestmentHolding {
    const holding = toHolding(rowOf(answer, verb, 'answer'));
    if (!holding) {
      throw new Error(`The ledger file answered ${verb} with a holding it could not describe.`);
    }
    return holding;
  }

  // ── Dismissals ────────────────────────────────────────────────────────────

  /**
   * Record that the user does not want a suggestion offered again.
   *
   * IDEMPOTENT, AND "FIRST WINS" RATHER THAN "LAST WINS". Refusing something
   * already refused answers with the record that is already there — its id, its
   * date and ITS subjects — and writes nothing. That is the cloud's own
   * behaviour (insert, catch the unique violation, return what it finds) rather
   * than an upsert, and the difference is reachable: an upsert would move
   * `dismissedAt`, which the table's own migration says must go on meaning *when
   * you first said no*, and would replace the subject ids the "Dismissed" list
   * describes the refusal back to the user with.
   *
   * The answer is the whole dismissal, so the caller can put it straight into
   * state without re-reading — which is what `AppContextSupabase` does, keyed by
   * `(kind, subjectKey)` exactly as the table's unique constraint is.
   *
   * `subjectIds` ARE TRANSACTIONS, and this engine means it: they are a foreign
   * key in a file where the cloud has only a column comment claiming as much. A
   * refusal about a row that does not exist is therefore refused here and stored
   * there — a declared divergence, argued in the verb, and one nothing a user
   * does can reach, because a sweep only ever offers rows it has just read.
   *
   * The three payee kinds go through this same door with NO subject ids at all:
   * their `subjectKey` is percent-encoded payee text, and the emptiness is what
   * keeps the prune trigger off them. The file's `kind` CHECK admitted four of
   * the seven until slice 23, which would have made Settings → Payee cleanup
   * unable to save on a local ledger; the CHECK is where that was fixed.
   */
  async dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    const answer = await this.#ask(
      'dismiss_suggestion',
      toDismissalPayload(kind, subjectKey, subjectIds)
    );
    return toDismissal(rowOf(answer, 'dismiss_suggestion', 'answer'));
  }

  /**
   * Undo a refusal; the suggestion is offered again from the next scan.
   *
   * THE ROW IS DELETED. There is no flag and no soft delete — the cloud has no
   * UPDATE policy on the table for the same reason, and the file has a trigger
   * that would ABORT one — so "restore" restores the SUGGESTION rather than
   * un-marking the dismissal. The subjects go with it by the key.
   *
   * Keyed by `(kind, subjectKey)` and never by id, because the screen offering
   * "undo" is looking at a suggestion and has never seen a dismissal row. BOTH
   * halves matter: the same rows can legitimately be refused as a transfer pair
   * AND as a duplicate, and undoing one must not un-hide the other, whose
   * consequence is deleting a row rather than linking two.
   *
   * Undoing something nobody refused is a no-op rather than an error — the same
   * rule `dismissSuggestion` keeps at the other end, and the case a second
   * device produces.
   */
  async restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void> {
    await this.#ask('restore_suggestion', toDismissalKey(kind, subjectKey));
  }

  // ── Categories ────────────────────────────────────────────────────────────

  /**
   * One category, as somebody typed it.
   *
   * The draft is FILTERED to the verb's own arguments, which is what the cloud's
   * own mapper does: `categoryToDb` is a whitelist of eleven fields, so a key it
   * has never heard of never reaches the table. `Partial<Category>` and
   * `Omit<Category, 'id'>` both carry `description`, which has a column in
   * neither engine, and a port that sent it would refuse an edit the cloud
   * performs. `writes.ts` sets out the whole rule: do what the cloud's mapper
   * does with an unknown key, which is a different answer for each of the three
   * entities that has one.
   *
   * The id comes back USABLE (B-5): the caller uses it on the next line as the
   * value of the select it just added an option to, and as the `parentId` of the
   * children a tree import creates in its second pass. The verb mints a uuid
   * where the cloud's column default would, because `categories.id` in a file is
   * TEXT with no default — it also holds the slug ids a seed writes.
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const answer = await this.#ask('create_category', toCategoryCreatePayload(category));
    return toCategory(rowOf(answer, 'create_category', 'answer'));
  }

  /**
   * A tree's worth at once.
   *
   * NOTHING IN, NOTHING OUT, AND THE STORE IS NOT OPENED. The empty case is
   * answered here rather than by the verb, because "nothing was written" is a
   * statement about not crossing the seam at all — and it is the ordinary case
   * rather than a caller's mistake: an import that only adds detail to groups the
   * account already has plans no new groups, and asks anyway, because the plan is
   * computed before it is known to be empty. Both cloud writers return before
   * they look at a connection for the same reason.
   *
   * The answers come back in id order, which is the crate's choice and not a
   * promise to the caller: the seam says answers are matched to requests BY NAME,
   * never by position.
   */
  async createCategories(categories: Array<Omit<Category, 'id'>>): Promise<Category[]> {
    if (categories.length === 0) return [];
    const answer = await this.#ask('create_categories', {
      categories: categories.map(toCategoryCreatePayload)
    });
    // `rowsOf`, not `rowOf` — the two list-answering writes in this family wrap
    // their rows exactly as the READS do (`{ answer: { categories: [...] } }`),
    // because that is the shape the differential harness compares a verb on.
    return rowsOf(answer, 'create_categories', 'categories').map(toCategory);
  }

  /**
   * Change a category, and hand back the whole category as it now stands.
   *
   * A category that is not there is refused BY NAME and the store is left
   * exactly as it was — the verb reads the row before its first write. That is
   * the port of one word in the cloud's query: `.single()`, which turns "matched
   * no row" into an error. `deleteCategory` below has no such clause and is
   * therefore a successful nothing on the same id, which is not an inconsistency
   * but two faithful ports of two queries.
   */
  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const answer = await this.#ask('update_category', {
      id,
      patch: toCategoryUpdatePatch(updates)
    });
    return toCategory(rowOf(answer, 'update_category', 'answer'));
  }

  /**
   * Remove a category, AND THE CATEGORIES UNDER IT.
   *
   * The cascade is the seam's rule rather than one engine's foreign key, and the
   * file keeps it twice over: the verb walks the subtree and deletes it deepest
   * first, and `parent_id ON DELETE CASCADE` is underneath that. The walk is
   * what makes each removed row auditable and counted.
   *
   * ONE ID IS REFUSED, and it is not this port's refusal: an account's To/From
   * category is system bookkeeping and C-5 — the same trigger in both engines —
   * will not let one go while its account exists. The refusal arrives with the
   * trigger's own message and is passed to the caller unaltered (seam rule 4),
   * which is what the screen puts on the page.
   *
   * Answers `void`, and the verb answers with a count anyway. Discarded here for
   * `closeAccount`'s reason: a return value nobody reads is a return value that
   * will one day be read wrongly.
   */
  async deleteCategory(id: string): Promise<void> {
    await this.#ask('delete_category', { id });
  }

  // ── Categories, in bulk ───────────────────────────────────────────────────

  /**
   * Remove the categories nothing is filed against.
   *
   * B-6 gives this engine 're-judges every row and keeps the ones still in use',
   * and the count is what ACTUALLY went — never the size of the list. The caller
   * prints that figure ("pruned 40, kept 12 in use") and re-reads the category
   * set because of it, so a count derived from the request would be a guess in
   * the shape of a fact.
   */
  async deleteUnusedCategories(ids: string[]): Promise<number> {
    const answer = await this.#ask('delete_unused_categories', { ids });
    return countOf(rowOf(answer, 'delete_unused_categories', 'answer'), 'delete_unused_categories', 'deleted');
  }

  /** Move every reference from one category to another, then remove the source. */
  async mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    const answer = await this.#ask('merge_categories', {
      source_id: sourceId,
      target_id: targetId
    });
    const named = (key: string): number => countOf(answer, 'merge_categories', key);
    return {
      // Echoed by the verb because the source is gone and this is the only
      // record of which id the caller named.
      sourceId: textOf(answer, 'merge_categories', 'source_id'),
      targetId: textOf(answer, 'merge_categories', 'target_id'),
      transactions: named('transactions'),
      splitLines: named('split_lines'),
      splitTransactions: named('split_transactions'),
      budgets: named('budgets'),
      recurring: named('recurring')
    };
  }

  // ── Emptying it ───────────────────────────────────────────────────────────

  /**
   * Is there anything here at all?
   *
   * REJECTS rather than guessing, unlike the three boot reads. There is no
   * honest fallback: `true` from a file that could not be opened would unlock
   * the restore button in front of a ledger full of data.
   */
  async financialDataIsEmpty(): Promise<boolean> {
    const answer = await this.#ask('user_financial_data_is_empty');
    return rowOf(answer, 'user_financial_data_is_empty', 'answer').empty === true;
  }

  /**
   * Read every table whole and build the file the user downloads.
   *
   * ── ONE FORMAT, THREE ENGINES, ONE BUILDER ──────────────────────────────
   *
   * The verb answers with ROWS — fifteen sections of whole rows, spelled the
   * way the cloud's own columns are spelled, because `crate::backup` reads its
   * column maps in this direction as well as the other. Everything that turns
   * rows into a FILE happens in `buildBackupBundle`, which is the same function
   * the cloud export and the browser export call: the format tag, the schema
   * version, the per-entity counts, the `links` payload read off the rows, and
   * the money-precision guard that refuses to write a figure the round trip
   * would alter. None of it is re-implemented here, and that is B-11's whole
   * claim — *the backup a cloud login writes restores into a file, and the
   * backup a file writes restores into a cloud login* — made structural rather
   * than asserted.
   *
   * ── `onProgress` IS NOT ACCEPTED, AND THAT IS THE HONEST ANSWER ─────────
   *
   * The seam asks for progress per table *"because a real dataset is 50k+ rows
   * and 50+ round trips"*, and says an engine with nothing to report *"stays
   * silent rather than estimating"*. There is ONE round trip here, inside one
   * read transaction, so the fifteen sections do not become available one at a
   * time — they arrive together. Firing fifteen callbacks on the way past would
   * paint a bar that is a description of a loop rather than of the work, which
   * is `importTransactions`'s reason for the same omission.
   *
   * ── PREFERENCES: A SECOND CROSSING, AND WHY IT IS NOT FOLDED IN ─────────
   *
   * It used to read *"`null`, and the day `read_preferences` exists this line is
   * where it lands"*. Slice 28 is that day, and this is that line.
   *
   * They are asked for SEPARATELY rather than added to `collect_backup`'s
   * fifteen sections, and the reason is the format's rather than this port's: a
   * backup carries preferences as a TOP-LEVEL section, not as a table, because
   * `user_preferences` is not one of `BACKUP_ENTITIES`' fifteen on any engine.
   * The cloud's collector walks fifteen tables and then reads the document
   * through the preferences transport; so does this. A sixteenth entity here
   * would be a file the other two editions could not read.
   *
   * IT IS ALLOWED TO REJECT, and the cloud says why where its own transport
   * throws: *"a backup that quietly recorded 'no preferences' for a user who has
   * fifty is the failure this whole change exists to end."* `collectBackup` is
   * not one of the three reads that may never reject, so it does not soften this
   * into a `null` that reads exactly like a person who has never changed a
   * setting.
   *
   * `null` is still the answer for a file that genuinely holds no document, and
   * it is the format's own word for it — which is what keeps `restoreBackup`
   * below from reporting a loss that did not happen.
   */
  async collectBackup(): Promise<BackupBundle> {
    const answer = await this.#ask('collect_backup');
    const data = rowOf(rowOf(answer, 'collect_backup', 'answer'), 'collect_backup', 'data');
    const preferences = await this.#readPreferences();

    const sections: Record<string, BackupRow[]> = {};
    for (const entity of Object.keys(data)) {
      // `listOf` refuses a section that is not a list, for its usual reason: a
      // table that answered with nothing and a table that answered with the
      // wrong shape are different failures, and only one of them is a backup.
      sections[entity] = listOf(data, 'collect_backup', entity);
    }

    return this.#format.build({
      // The file's own owner, which a restore IGNORES on every engine — every
      // row is re-owned to whoever restores it (X-6). It is in the file so that
      // somebody holding two backups can tell which ledger each came out of.
      sourceUserId: this.#owner,
      exportedAt: new Date().toISOString(),
      data: sections,
      preferences
    });
  }

  /**
   * This file's settings document, or `null` when it holds none.
   *
   * One place rather than two, because `collectBackup` and the day something
   * else wants them must not be able to disagree about what `null` means. The
   * distinction is load-bearing everywhere it is read: `null` is *"nothing has
   * ever been saved here"* and `{ values: {} }` is *"everything is at its
   * default"*, and `PreferencesService.attach` takes a different branch for each
   * — the first is what makes it LIFT this machine's settings into the store.
   */
  async #readPreferences(): Promise<PreferencesDocument | null> {
    const answer = await this.#ask('read_preferences');
    const stored = field(rowOf(answer, 'read_preferences', 'answer'), 'preferences');
    if (stored === null) return null;
    if (stored === undefined) {
      // The key missing altogether is a FAULT, not an absence. `rowsOf`'s rule,
      // applied to the one answer where the wrong reading is silent: a backup
      // that recorded "no settings" for somebody who has fifty is exactly what
      // this section exists to prevent.
      throw new Error('The ledger file did not say whether it holds any settings.');
    }
    return parsePreferencesDocument(stored);
  }

  /**
   * Pour a file back in — one call, one transaction.
   *
   * ── THE IDS ARE REMAPPED HERE, BEFORE A SINGLE ROW IS SENT ──────────────
   *
   * `crate::backup` states the boundary twice because it matters: *"ids arrive
   * already remapped, or they do not arrive remapped at all"*. The remap is the
   * app's rule (`remapBackupIds`), it is the same rule on all three engines, and
   * a Rust copy of it would be a second implementation drifting from the one the
   * file is actually validated against. Every id is replaced unconditionally —
   * primary keys in a backup are unique across the whole store rather than per
   * owner, so a file restored anywhere but where it came from carries ids that
   * belong to somebody else's rows, which is the MAIN case a backup exists for.
   * A reference the file does not contain is left exactly as it was and comes
   * back in `danglingRefs` rather than blanked.
   *
   * ── THE STEP ORDER IS THE FORMAT'S, AND IT IS LOAD-BEARING ──────────────
   *
   * `RESTORE_STEPS` — accounts first, categories level by level, parents before
   * children. Accounts first is not a convention: `trg_create_transfer_category_
   * for_account` stands itself down while the file holds no Transfer anchor, so
   * a restore that sent categories first would have the trigger mint a To/From
   * category for every account and then insert the file's own beside it. Rule 84
   * is that sentence as a test.
   *
   * ── B-10: ONE TRANSACTION, AND THE THREE ANSWERS IT HAD TO INVENT ───────
   *
   * The cloud restores in chunks that each commit on their own, so a failure
   * halfway leaves the login PARTLY POPULATED. This is one call in one
   * transaction: it either landed or it did not. The seam declares that
   * difference rather than hiding it, and three fields of `RestoreOutcome` had
   * to be answered for an engine shaped this way — the ratchet that used to hold
   * this operation argued for a whole slice that they could not honestly be
   * guessed at until a collect existed to close the round trip. They are:
   *
   *   `restored` — per STEP, in step order, because that is what the screen
   *   prints. The verb answers `inserted` positionally, one figure per chunk in
   *   the order the chunks were given, so the labels stay in TypeScript where
   *   both other engines already read them and the crate never learns what a
   *   step is called.
   *
   *   `notStoredLocally` — EMPTY, and that is a statement rather than a stub:
   *   B-11 gives this engine `notStored: []` and the file holds all fifteen
   *   tables. The verb's `dropped` is NOT mapped into it — `dropped` is per
   *   COLUMN (a cloud row carrying a figure this schema has no home for), and
   *   `notStoredLocally` is per TABLE. Mapping one to the other would make
   *   B-11's claim false for a reason that has nothing to do with tables. It is
   *   reported through the logger instead, which is where this port sends
   *   everything a person needs to know and the seam has no field for.
   *
   *   `preferencesRestored` / `preferencesFailure` — the settings, put back
   *   LAST and OUTSIDE the transaction. This used to be `0` and a sentence
   *   apologising for it, because there was no `write_preferences` verb; slice
   *   28 built one, and the interesting decision is not that they now land but
   *   WHERE.
   *
   *   They are a second crossing, after the restore has committed, and NOT one
   *   more chunk inside it. That is deliberate and it is the cloud's ordering
   *   for the cloud's stated reason: *"a restore that threw away a complete,
   *   correct ledger because a toggle could not be saved would be the wrong
   *   trade by an enormous margin."* B-10 makes this engine's restore ONE
   *   transaction, so folding the document in would make that trade — a
   *   document over the 256 KiB ceiling, or one the schema's `is_object` CHECK
   *   refuses, would roll back every account, transaction, budget and goal in
   *   the file. The count and the sentence exist precisely so that this can be
   *   reported instead of thrown, and they are only true if the rows are
   *   already safe when the settings are attempted.
   */
  async restoreBackup(bundle: BackupBundle): Promise<BackupRestoreOutcome> {
    const { bundle: remapped, danglingRefs } = this.#format.remapIds(bundle);

    const steps = this.#format.steps;
    const answer = await this.#ask('restore_backup', {
      chunks: steps.map(step => ({
        entity: step.entity,
        rows: this.#format.rowsForStep(remapped, step)
      })),
      links: remapped.links
    });
    const result = rowOf(answer, 'restore_backup', 'answer');

    const counts = field(result, 'inserted');
    if (!Array.isArray(counts) || counts.length !== steps.length) {
      // A FAULT, not a refusal: the answer is matched to the steps by POSITION,
      // so a shorter list would silently report the wrong number of rows against
      // the wrong table — on the one operation there is no second copy of.
      throw new Error(
        `The ledger file was sent ${steps.length} restore steps and did not answer for all of them.`
      );
    }
    const rowsAt = (index: number): number => {
      const value: unknown = counts[index];
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        // `countOf`'s rule, applied to a POSITION rather than to a key: "0 rows
        // restored" and "the answer did not say" are different sentences, and
        // this is the screen where only one of them is true.
        throw new Error(
          `The ledger file did not say how many rows it restored for ${steps[index].label}.`
        );
      }
      return value;
    };

    const dropped = field(result, 'dropped');
    if (Array.isArray(dropped) && dropped.length > 0) {
      this.#logger.error(
        `The restore stored every row, and ${dropped.length} figure(s) in them had no column in this ledger`,
        dropped
      );
    }

    // Read BEFORE the settings are attempted, not in the return below: `rowsAt`
    // throws on an answer that did not say how many rows a step restored, and
    // that fault must not be reached after a second write has already gone out.
    const restored = steps.map((step, index) => ({ label: step.label, rows: rowsAt(index) }));

    // ── The settings, LAST ─────────────────────────────────────────────────
    // Every financial row is committed by the time this runs. See the header
    // for why that ordering is the whole point rather than a detail.
    let preferencesRestored = 0;
    let preferencesFailure: string | null = null;
    if (remapped.preferences !== null) {
      // The count is of the document's own settings, computed here exactly as
      // the cloud and the browser compute it — the crate does not know that a
      // preferences document HAS a `values` map, and this is not the place to
      // teach it one.
      const settings = Object.keys(remapped.preferences.values).length;
      try {
        await this.#ask('write_preferences', { preferences: remapped.preferences });
        preferencesRestored = settings;
      } catch (error) {
        // Reported, not thrown, and the engine's own sentence is passed through
        // for seam rule 4's reason: the screen prints it. The logger gets it too
        // because `preferencesFailure` is rendered as one line and a support
        // conversation needs the whole error.
        preferencesFailure = error instanceof Error ? error.message : String(error);
        this.#logger.error(
          'The restore put every financial row back, and could not store the settings in the file',
          error
        );
      }
    }

    return {
      restored,
      accountsRelinked: countOf(result, 'restore_backup', 'accounts_relinked'),
      transactionsRelinked: countOf(result, 'restore_backup', 'transactions_relinked'),
      preferencesRestored,
      preferencesFailure,
      danglingRefs,
      // B-11. A statement, not a stub: a file on this device holds every table
      // the format carries.
      notStoredLocally: []
    };
  }

  /**
   * Erase everything this file holds.
   *
   * ── THE PHRASE IS SUPPLIED HERE, AND THAT IS THE SEAM'S DECISION ────────
   *
   * `wipeAllFinancialData` takes no confirmation: the SCREEN holds it, and both
   * callers refuse to enable their button until it has been typed exactly. A
   * phrase that travelled across the seam would be a string an implementation
   * could get wrong; the screen's is one the user typed. So the implementation
   * supplies whatever its own engine demands, and this is that literal.
   *
   * It is the fourth copy — the SQL function's own check, the crate's
   * `CONFIRMATION`, `LOCAL_WIPE_CONFIRMATION` and this — and that is safe
   * precisely because every one of them CHECKS it: a copy that drifted would
   * refuse every wipe on the first run rather than weaken one, and the contract
   * suite asks for a wipe that works.
   *
   * `onProgress` is never called, for `importTransactions`'s reason: one atomic
   * write has no honest fraction. The callers already treat silence as normal.
   */
  async wipeAllFinancialData(): Promise<void> {
    await this.#ask('wipe_user_financial_data', { confirm: WIPE_CONFIRMATION });
  }

  // ── Coming from another money manager ─────────────────────────────────────

  /**
   * Replace everything with a parsed Microsoft Money file.
   *
   * ── IT IS A WIPE AND A RESTORE, AND THAT IS THE WHOLE IMPLEMENTATION ─────
   *
   * The ratchet said so before the operation was written — *"`importMsMoney` is
   * composed from a wipe and a restore, both of which now exist and are green …
   * it needs no new rule at all"* — and the sentence turns out to be literal
   * rather than a summary. A total migration IS `wipeAllFinancialData()` followed
   * by `restoreBackup()`, because the seam defines both of those in terms of each
   * other already: *"a wipe is defined by the restore that follows it"*, and
   * *"a restore REPLACES; it does not merge"*. Between them they are exactly what
   * this operation promises, so it borrows them instead of restating them, and no
   * write path in this file is reachable only from a migration.
   *
   * The three engines each compose their own edition's writes over ONE plan.
   * `importToCloud` wipes in chunks and then batches inserts through PostgREST
   * with a second pass for the links, because thirty-four thousand rows cannot
   * cross in one request. `importToLocalStorage` writes seven storage keys in one
   * IndexedDB transaction. This writes ONE `restore_backup`, which is ONE SQLite
   * transaction, and inherits every property slice 25 proved about it.
   *
   * ── WHAT THE WIPE IS FOR HERE, WHICH IS NOT WHAT IT LOOKS LIKE ──────────
   *
   * Not tidiness, and not "replace means delete first". `restore_backup` REFUSES
   * a store that still holds an account, a category or a transaction
   * (`restore_target_not_empty`) — it asks once, about the whole file, before a
   * row lands. So the wipe is the PRECONDITION of the write that follows it, and
   * an import that skipped it would not quietly merge two ledgers: it would
   * reject, having changed nothing. That is a much better failure than the cloud's
   * (which would insert on top), and it is the reason this composition is safe to
   * state as two calls rather than one.
   *
   * ── C-3: WHOSE "To/From" CATEGORIES SURVIVE ──────────────────────────────
   *
   * A Money file BRINGS its own transfer categories — the transform mints a
   * `To/From <account>` detail row per account under a `Transfer` type root — and
   * this schema mints them TOO, from `trg_create_transfer_category_for_account`.
   * Two To/From categories for one account is not cosmetic: the transfer picker
   * offers the same account twice under two ids and half the history files under
   * the one the other half does not use.
   *
   * The collision is avoided the same way in both engines, and neither has a
   * special case for it. `importToCloud` inserts accounts (at 0.05) BEFORE
   * categories (at 0.15); `RESTORE_STEPS` puts accounts first for its own reasons.
   * Either way the accounts land while the store holds NO type-level Transfer
   * anchor, and both triggers stand themselves down without one. The file's own
   * To/From rows then arrive unopposed. Contract rule 84 is that sentence as a
   * test, and it is a rule this operation now depends on rather than one it
   * merely passes.
   *
   * ── THE IDS ARE THE PLAN'S, THEN THE FORMAT'S ───────────────────────────
   *
   * Twice, and both remaps are the app's own rather than this port's.
   * `planCloudImport` replaces Money's stable ids (`mny-txn-<htrn>`) with minted
   * ones and follows every cross-reference — the transfer pairs, the split-leg
   * pins, the per-account transfer categories, the investment↔cash pairings.
   * `restoreBackup` then runs `remapBackupIds` over the result, which is the same
   * rule every restore gets on every engine. The plan's ids therefore never reach
   * the file (see {@link MsMoneyMigration}), and Money's own ids do survive —
   * `import_source_id` is a backup column and is not a reference, so it travels
   * verbatim and a future re-import can still recognise what it already holds.
   *
   * ── THE TWO FLAGS, AND THE ONE THAT IS DELIBERATELY NOT SET ─────────────
   *
   * `is_cleared` and `is_reconciled` come from the plan, which reads Money's `cs`
   * through the transform: C and R both arrive MARKED, only R arrives COMMITTED.
   * Both are stated explicitly on every row — an unstated `is_reconciled` is NULL
   * in this schema and means *"ask is_cleared"*, which would read a whole
   * unfinished balance session as settled work.
   *
   * `needs_review` is NOT stated, and that is the importer law rather than an
   * omission. Migration 20260810090000 says it in as many words: the file
   * importer's rows arrive `needs_review = true` because a statement is new work,
   * and *"the Microsoft Money importer … is left alone for the same reason in
   * reverse: it is a migration of history the user already worked through in
   * Money … lighting up eleven thousand rows of it would be the 'mark history
   * NEW' mistake by another route."* The seam repeats it on `importTransactions`.
   * So the column is left unsaid, `crate::backup` gives a NOT NULL column its
   * schema default, and the rows land REVIEWED — which is what the cloud's own
   * INSERT produces, by the same silence.
   *
   * ── WHAT IT REPORTS, AND WHAT IT REFUSES ────────────────────────────────
   *
   * IT REJECTS, as the seam requires and unlike `importTransactions`: there is no
   * halfway answer to render for a total migration. Every refusal below reaches
   * the caller with the crate's or the format's own sentence on it — including
   * `buildBackupBundle`'s precision guard, which refuses to write a file whose
   * figures the round trip would alter. Refusing a migration is survivable;
   * altering somebody's money is not.
   *
   * Progress is four phases, and every one of them is a thing that really
   * happened: the wipe, the plan, the write, and done. `importToLocalStorage`'s
   * reasoning applies to the write — *"one phase, because there is one write.
   * Reporting 'writing accounts…', 'writing categories…' against a single atomic
   * call would be inventing progress the import does not make"* — and it applies
   * to the wipe too, which is also one crossing here.
   */
  async importMsMoney(
    result: MsMoneyImportResult,
    options: { onProgress?: (progress: ImportProgress) => void } = {}
  ): Promise<void> {
    const { onProgress } = options;

    onProgress?.({ phase: 'wiping', fraction: 0.02, message: 'Backing out existing data…' });
    await this.wipeAllFinancialData();

    onProgress?.({ phase: 'accounts', fraction: 0.2, message: 'Preparing your data…' });
    const plan = this.#migration.plan(result, this.#owner);

    // The second pass, folded back onto the rows it belongs to. A backup carries
    // its links BOTH ways — as columns on the rows and as the `links` payload —
    // and `buildBackupBundle` derives the second from the first, so putting the
    // columns on is what makes the payload right. `extractTransactionLinks` then
    // takes only the rows that carry one, which is what stops the restore's link
    // pass from touching (and re-dating) every row in the file.
    const accountParents = new Map<string, Record<string, string>>();
    for (const link of plan.accountParents) {
      accountParents.set(link.id, { parent_account_id: link.parent_account_id });
    }
    const transactionLinks = new Map<string, Record<string, string>>();
    for (const link of plan.transferLinks) {
      transactionLinks.set(link.id, {
        ...transactionLinks.get(link.id),
        linked_transfer_id: link.linked_transfer_id
      });
    }
    for (const pin of plan.splitLegPins) {
      transactionLinks.set(pin.id, {
        ...transactionLinks.get(pin.id),
        linked_transfer_split_id: pin.linked_transfer_split_id
      });
    }

    const bundle = this.#format.build({
      // The file's own owner. A restore re-owns every row to whoever is
      // restoring (X-6), so on this path it is the same login twice — but it is
      // stated rather than left blank, because what is being built here IS a
      // backup file and half of one is not.
      sourceUserId: this.#owner,
      exportedAt: new Date().toISOString(),
      data: {
        accounts: withColumns(plan.accounts, accountParents),
        categories: plan.categories.slice(),
        transactions: withColumns(plan.transactions, transactionLinks),
        transaction_splits: plan.splits.slice()
      },
      // A .mny file carries no app settings. `null` is the format's word for
      // that, and it is what keeps `restoreBackup` from reporting a loss that
      // did not happen.
      //
      // It USED to say "and this edition could not store them yet if it did".
      // Slice 28 removed the second half rather than the line: the edition can
      // store them now, and this still sends `null` — because Microsoft Money
      // has no opinion about which accounts your dashboard pins. The settings a
      // person already had therefore SURVIVE a migration, which is right and is
      // not an accident: `wipe_user_financial_data` deletes ten tables and
      // `user_preferences` is not one of them, on either engine.
      preferences: null
    });

    onProgress?.({ phase: 'transactions', fraction: 0.5, message: 'Writing your data…' });
    const outcome = await this.restoreBackup(bundle);

    // A migration that produced a reference to a row it did not write is a
    // defect in the PLAN, not in the file, and it is invisible to the caller:
    // `importMsMoney` answers `void`, so there is nowhere for this to go but the
    // logger — the same place the restore's per-column `dropped` list goes, and
    // for the same reason. Empty on every well-formed plan.
    if (outcome.danglingRefs.length > 0) {
      this.#logger.error(
        `The Microsoft Money migration landed, and ${outcome.danglingRefs.length} reference(s) in it named a row the import did not write`,
        outcome.danglingRefs
      );
    }

    onProgress?.({ phase: 'done', fraction: 1, message: 'Import complete.' });
  }

  // ── Lifecycle, and what this engine can do ────────────────────────────────

  /**
   * Nothing to reconcile: a file has no login to look up and no row to create
   * for one. The seam already calls this "a no-op for an implementation that
   * has no accounts to reconcile", and the arguments are accepted and ignored
   * rather than removed, because the caller is the same boot effect either way.
   */
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * The categories the ledger is about to be read through — and, on a file that
   * has none, the act of putting them there.
   *
   * ── B-4, AND WHY IT IS ONE CROSSING ─────────────────────────────────────
   *
   * The divergence table gives this engine *'seeds the defaults into the store'*,
   * against browser storage's *'answers with the defaults and stores nothing'*
   * and the cloud's *'migrates a set into the account and keeps it'*. The verb
   * behind it is the port of `ensureCategories`' whole body: read, and — only if
   * the read came back empty — write the set it was given, then answer with what
   * is stored either way.
   *
   * The CLIENT makes two round trips of that and this makes one, deliberately.
   * A file has no second session to race, so the emptiness test and the insert
   * belong in one transaction; and the cloud's way of handling the race is a
   * refusal (`categories_already_migrated`), which a port would have to BRANCH
   * ON A CODE to recover from. PHASE3-PLAN D-3 forbids that in as many words.
   *
   * ── THE TREE IS THE APP'S, NOT THE CRATE'S ──────────────────────────────
   *
   * `defaultCategorySeed()` is `src/data/defaultCategories.ts`, the same list
   * browser storage answers with and the cloud migrates — sent in the payload
   * exactly as `p_categories` is. One list for three engines; a copy in Rust
   * would be a second one, going stale the first time a group was added to the
   * starter set. The ids travel as themselves, which is the whole of *'never
   * remaps'*: `'transfer-in'` is still `'transfer-in'` when the ledger asks.
   *
   * ── WHO CALLS IT, AND THE OBLIGATION THAT LEAVES FOR SLICE 27 ───────────
   *
   * `loadBoot` does NOT, on this engine, and that is asserted rather than
   * assumed — the contract suite spies on this method and fails the composite if
   * it was reached. Two reasons, and they point the same way: the local boot is
   * ONE crossing of ONE transaction (BOOT_COMPOSITION), and seeding is a
   * deliberate act rather than a side effect of looking at a file. A `load_boot`
   * that wrote categories would be a read verb that writes, and the day somebody
   * opened a colleague's ledger to look at it, it would change it.
   *
   * So the ordering the seam states for every engine — *"this must resolve
   * before any transaction or budget read"* — is kept by the CALL SITE here,
   * where the cloud keeps it inside its own `loadBoot`. The device boot slice 27
   * writes must `await port.prepareCategories()` before `port.loadBoot()`. It is
   * idempotent, so calling it on every launch costs one crossing that answers
   * from the file it was going to read anyway.
   */
  async prepareCategories(): Promise<Category[]> {
    const answer = await this.#ask('seed_categories', { categories: defaultCategorySeed() });
    return rowsOf(answer, 'seed_categories', 'categories').map(toCategory);
  }

  /**
   * One file on one machine: there is nothing to hear from, so nothing ever
   * fires and the handle is a no-op. B-8 declares that (`delivers: 'never'`)
   * rather than leaving it as a gap to be filled in later, and the contract
   * asserts what every engine owes regardless: the handle is a function, calling
   * it twice is safe, and nothing arrives after it has been called.
   *
   * `capabilities().realtime` is `false` beside it, which is what lets a caller
   * skip the debounce timers and suppression windows that exist solely to cope
   * with events that will never arrive.
   */
  subscribeToUpdates(): () => void {
    return () => {};
  }

  capabilities(): DataPortCapabilities {
    return { ...DEVICE_CAPABILITIES };
  }
}
