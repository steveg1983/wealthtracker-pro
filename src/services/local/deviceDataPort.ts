/**
 * The DEVICE edition's one production entry point to the seam.
 *
 * `services/port/index.ts` is the cloud's. This is the twin, and the two files
 * say the same thing about different engines:
 *
 *     export const dataPort: DataPort = DataService;              // the cloud
 *     export const dataPort: DataPort = requireDeviceDocument().port;  // a file
 *
 * ── WHY A SECOND FILE AND NOT A BRANCH IN THE FIRST ─────────────────────────
 *
 * `services/port/index.ts` says "when the local edition arrives, this is the
 * only file that has to choose between implementations", and that sentence had
 * two readings. The wrong one is a branch: `isDesktop() ? LocalDataPort : …`,
 * which would put `LocalDataPort`, the Tauri transport and the whole ledger
 * crate's wire format into the WEB bundle so that a runtime test could discard
 * them, and would put `DataService`, a Supabase client, Clerk and Sentry into
 * the DESKTOP bundle for the same reason in reverse. The bundle greps this
 * edition exists to pass would both fail on the first build.
 *
 * The right reading is that the CHOICE is one file — and that which file it is
 * is settled before a line of JavaScript runs, by the build. Shared UI imports
 * `@data`; `@data` resolves to `services/port/index.ts` in the web build and to
 * this module in the desktop build; neither bundle contains the other's engine
 * because neither bundle's graph can reach it. `docs/edition-gating.md` states
 * the whole mechanism and `src/services/__tests__/dataAlias.test.ts` asserts
 * that these two modules stay substitutable for one another.
 *
 * ── WHY THE PORT IS RESOLVED AT MODULE SCOPE, AND WHAT THAT DEMANDS ─────────
 *
 * The cloud's engine is a static class that exists as soon as its module is
 * evaluated. A device's engine is a FILE THE PERSON CHOSE, so it cannot exist
 * before they choose it — and the app's thirteen consumers import `dataPort` as
 * a module-scope singleton, which is not a shape that can wait.
 *
 * Rather than wrap the port in something that CAN wait — a delegating object,
 * fifty-six forwarding methods, a refusal per operation — this module states the
 * ordering rule instead and lets the import fail loudly if it is broken:
 * **the application's module graph is loaded after the ledger is open.** That
 * costs a desktop nothing, because a window cannot render a ledger it has not
 * opened; `src/desktop/main.tsx` chooses a file, opens it, boots it, and only
 * then imports the app. It is the same shape slice 28 gave the identity, for the
 * same reason, and `requireDeviceDocument` carries the sentence a future entry
 * that got the order wrong will read.
 *
 * ── THE TYPES ARE RE-EXPORTED, AND THAT IS NOT A COURTESY ───────────────────
 *
 * A component writes `import { dataPort, type BulkImportResult } from '@data'`.
 * One specifier, one edition-blind door, values and types together — so this
 * module must answer for the same vocabulary its twin does or the alias is not a
 * substitution at all, it is a subset that happens to compile in one build. The
 * list below is `services/port/index.ts`'s list, and a test compares the two
 * rather than trusting that whoever adds the next name remembers there are two
 * places to add it.
 */

import type { DataPort } from '../port/dataPort';
import { requireDeviceDocument } from './deviceDocument';

export type {
  AccountBalanceSnapshot,
  BackupBundle,
  BackupEntity,
  BackupRestoreOutcome,
  BackupRow,
  BootSnapshot,
  BootTransactionStats,
  BootTransactionsResult,
  BulkImportProgress,
  BulkImportResult,
  DanglingReference,
  DataPort,
  DataPortAccountWrites,
  DataPortBackupLifecycle,
  DataPortBoot,
  DataPortBulkWrites,
  DataPortCapabilities,
  DataPortCapabilityDescriptor,
  DataPortDismissalWrites,
  DataPortLifecycle,
  DataPortInvestmentWrites,
  DataPortMigration,
  DataPortPlanningWrites,
  DataPortReads,
  DataPortReportWrites,
  DataPortSplitWrites,
  DataPortTransactionWrites,
  DataPortTransferWrites,
  Edition,
  ExportProgress,
  ImportProgress,
  ImportSourceKind,
  InvestmentChanges,
  InvestmentDraft,
  InvestmentHolding,
  MoneyNumber,
  MsMoneyImportResult,
  QuoteWriteback,
  ReconciliationOutcome,
  RestoreProgress,
  SessionState,
  UnstorableEntity,
  WipeProgress
} from '../port/dataPort';

export const dataPort: DataPort = requireDeviceDocument().port;
