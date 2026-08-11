/**
 * The CLOUD edition's one production entry point to the seam.
 *
 * `dataPort` is the object callers should reach for. It is the existing
 * DataService, typed as the interface: the assignment is the compile-time
 * proof that today's implementation satisfies the seam, and it costs nothing
 * at runtime — no wrapper, no extra indirection, no second copy of anything.
 *
 * ── THE OTHER EDITION HAS ITS OWN ───────────────────────────────────────────
 *
 * This file used to say that when the local edition arrived, it would be the
 * only file that had to choose between implementations. It arrived, and the
 * choice turned out to be one FILE PER EDITION rather than one branch in one
 * file: `services/local/deviceDataPort.ts` is the twin, one line long, and it
 * answers with the port over the ledger file the person opened.
 *
 * A branch here would have been the alternative, and it would have put both
 * engines in both bundles — a Supabase client, Clerk and Sentry in a program
 * that promises the money never leaves the machine, and the whole Rust wire
 * format in a browser tab — so that a runtime test could discard one of them.
 *
 * Callers therefore import neither file by name. They import `@data`, which the
 * build resolves to whichever of the two this program is. Nothing above the seam
 * knows which it got, which is the entire point, and
 * `src/services/__tests__/dataAlias.test.ts` keeps the two substitutable.
 * `docs/edition-gating.md` states the mechanism.
 */

import { DataService } from '../api/dataService';
import type { DataPort } from './dataPort';

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
  DataPortMigration,
  DataPortPlanningWrites,
  DataPortReads,
  DataPortSplitWrites,
  DataPortTransactionWrites,
  DataPortTransferWrites,
  Edition,
  ExportProgress,
  ImportProgress,
  ImportSourceKind,
  MoneyNumber,
  MsMoneyImportResult,
  ReconciliationOutcome,
  RestoreProgress,
  SessionState,
  WipeProgress
} from './dataPort';

export const dataPort: DataPort = DataService;
