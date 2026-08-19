/**
 * WHAT THE BROWSER'S STORE CANNOT KEEP — declared once, read twice.
 *
 * ── WHY IT IS A MODULE AND NOT A LIST IN EITHER OF ITS READERS ──────────────
 *
 * Two things need this list and they are on opposite sides of a seam:
 *
 *   `services/localBackupService.ts` builds the `stored: false` half of
 *   `LOCAL_BACKUP_BINDINGS` from it — the mapping a browser-local backup and
 *   restore actually walk;
 *
 *   `services/api/dataService.ts` answers `capabilities().cannotKeep` with it,
 *   SYNCHRONOUSLY, in a render.
 *
 * A second declaration would have been free to drift from the first, and drift
 * in exactly this list is the bug that produced this module: `RestoreBackupModal`
 * warned a person, before a restore, that a file held rows the target could not
 * keep — built from the browser's bindings, chosen by `backupTarget !== 'login'`.
 * A device edition matches that condition and keeps all fourteen tables, so it
 * would have been told its own budgets and goals could not be restored. A false
 * warning about data loss, in front of somebody deciding whether to press a
 * button.
 *
 * The fix was to make it a PORT question, and the port's cloud/browser half
 * answers it from here.
 *
 * ── AND IT IS CHEAP ON PURPOSE ──────────────────────────────────────────────
 *
 * This module imports two TYPES and nothing else, so it is erased to a single
 * frozen array at build. That matters: `localBackupService.ts` reaches the
 * storage adapter, `Decimal`, and fourteen row mappers, and `dataService` is in
 * the boot chunk. The arrow points from the heavy module to the light one and
 * never the other way.
 *
 * ── COMPLETENESS IS STILL localBackupService's TO GUARANTEE ─────────────────
 *
 * There is no `Record<BackupEntity, …>` here, because this list is deliberately
 * PARTIAL — it names the seven a browser has nowhere for, not all fourteen.
 * What stops a table joining the format with no decision recorded about it is
 * unchanged and lives where it always did: `LOCAL_BACKUP_BINDINGS` is keyed by
 * `BackupEntity`, so a missing key is a compile error, and the runtime check
 * beneath it repeats the question for a build that got here some other way.
 */

import type { BackupEntity } from './format';
import type { UnstorableEntity } from '../port/dataPort';

/**
 * The seven tables a backup file can carry that browser storage has no home
 * for, each with the sentence a person reading a restore warning is owed.
 *
 * Every one is a decision rather than an omission: local mode has no screen, no
 * writer and no reader for these, and inventing a storage key for data the app
 * cannot use would produce a backup nobody could restore into anything.
 *
 * `investments` and `investment_transactions` stayed on this list when holdings
 * joined the seam at slice 31, and that is the honest answer rather than a gap
 * left behind: the port's browser half serves `listInvestments` with an empty
 * list and refuses the four writes BY NAME (divergence B-12), because there has
 * never been a browser-local holdings store and inventing one in the commit that
 * ported the cloud's would have been a second engine nobody asked for. A
 * signed-out browser therefore behaves exactly as it did — `InvestmentService`
 * answered `[]` without a client, and the page said "Sign in to save holdings."
 */
export const BROWSER_CANNOT_KEEP: readonly UnstorableEntity[] = [
  {
    entity: 'goal_contributions',
    label: 'Goal contributions',
    absence: 'contributions towards a goal are only recorded when you are signed in'
  },
  {
    entity: 'investments',
    label: 'Investments',
    absence: 'holdings are only tracked when you are signed in'
  },
  {
    entity: 'investment_transactions',
    label: 'Investment transactions',
    absence: 'buys and sells are only recorded when you are signed in'
  },
  {
    entity: 'recurring_transactions',
    label: 'Recurring transactions',
    // wealthtracker_recurring is written by the demo seed and by nothing else,
    // in a shape that is not a recurring_transactions row, and read by nothing
    // at all. Backing that up would put rows in the file that no restore —
    // local or cloud — could use.
    absence: 'repeating templates are only kept when you are signed in'
  },
  {
    entity: 'notifications',
    label: 'Notifications',
    // NotificationContext keeps at most twenty of these for at most a week, in
    // plain localStorage. They are alerts about the data, not the data.
    absence: 'alerts are short-lived and are not part of a backup'
  },
  {
    entity: 'dashboard_layouts',
    label: 'Dashboard layouts',
    absence: 'dashboard arrangements are only saved when you are signed in'
  },
  {
    entity: 'widget_preferences',
    label: 'Widget preferences',
    absence: 'widget settings are only saved when you are signed in'
  },
  {
    entity: 'forecast_adjustments',
    label: 'Forecast adjustments',
    absence: 'forecast scenario adjustments are only kept when you are signed in'
  }
];

/** One entity's entry, for the binding table that is keyed by every table. */
export const browserAbsence = (entity: BackupEntity): UnstorableEntity => {
  const found = BROWSER_CANNOT_KEEP.find(entry => entry.entity === entity);
  if (!found) {
    // Unreachable from `LOCAL_BACKUP_BINDINGS`, which only asks about the seven
    // it declares `stored: false`. Named rather than defaulted, because a blank
    // reason is a warning that tells somebody nothing.
    throw new Error(
      `browserCoverage has no reason recorded for "${entity}". A table that browser ` +
      'storage cannot keep needs its sentence here, not an empty string.'
    );
  }
  return found;
};
