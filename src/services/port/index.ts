/**
 * The seam's one production entry point.
 *
 * `dataPort` is the object callers should reach for. It is the existing
 * DataService, typed as the interface: the assignment is the compile-time
 * proof that today's implementation satisfies the seam, and it costs nothing
 * at runtime — no wrapper, no extra indirection, no second copy of anything.
 *
 * When the local edition arrives, this is the only file that has to choose
 * between implementations.
 */

import { DataService } from '../api/dataService';
import type { DataPort } from './dataPort';

export type {
  AccountBalanceSnapshot,
  BackupBundle,
  BackupEntity,
  BackupRestoreOutcome,
  BackupRow,
  BootTransactionStats,
  BootTransactionsResult,
  BulkImportProgress,
  BulkImportResult,
  DanglingReference,
  DataPort,
  DataPortAccountWrites,
  DataPortBackupLifecycle,
  DataPortBulkWrites,
  DataPortDismissalWrites,
  DataPortLifecycle,
  DataPortMigration,
  DataPortPlanningWrites,
  DataPortReads,
  DataPortSplitWrites,
  DataPortTransactionWrites,
  DataPortTransferWrites,
  ExportProgress,
  ImportProgress,
  ImportSourceKind,
  MoneyNumber,
  MsMoneyImportResult,
  RestoreProgress,
  WipeProgress
} from './dataPort';

export const dataPort: DataPort = DataService;
