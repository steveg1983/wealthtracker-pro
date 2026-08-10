import { carryDemoFlag } from './navigation';

/**
 * The register deep link for a single transaction:
 * `/accounts/<accountId>?txn=<transactionId>`.
 *
 * The destination register owns everything that happens on arrival — it
 * selects the row, centres it in the list and docks it in quick edit, and it
 * meets a CLOSED account with the re-open offer. Callers only build the path.
 *
 * The demo flag is carried over explicitly rather than via preserveDemoParam:
 * that helper drops the flag outside development, and a jump taken inside a
 * demo session has to land inside the same session.
 */
export function buildTransactionRegisterPath(
  accountId: string,
  transactionId: string,
  currentSearch: string
): string {
  return carryDemoFlag(`/accounts/${accountId}?txn=${encodeURIComponent(transactionId)}`, currentSearch);
}
