/**
 * The first screen of a desktop window: "which ledger?".
 *
 * A browser opens on a sign-in. A window opens on a FILE CHOOSER, and that is
 * the whole of the difference the identity slice settled: the act that answers
 * "who are you" here is choosing a file, because the answer is the uuid inside
 * it.
 *
 * ── THE PORT ARRIVES AS A PROP, AND THAT IS DELIBERATE ──────────────────────
 *
 * Everywhere else in this application `dataPort` is imported. Here it is passed,
 * because this screen is the one that exists BEFORE there is a port: it is what
 * a person looks at while they decide which ledger to open. A module-scope
 * import would be a screen that cannot render until the thing it is for has
 * happened.
 *
 * That is also why it does not import `@data`. The alias is the edition-blind
 * door for SHARED surfaces; a desktop-only screen is not shared, and reaching
 * through the door would only mean asking the build a question this component
 * already knows the answer to.
 */

import type { ReactElement } from 'react';
import type { BootSnapshot, DataPortCapabilities } from '../services/port/dataPort';

/** What the window knows about the ledger it is showing. */
export interface OpenLedgerView {
  /** Where the file is. Shown, never sent — `document.rs` says why at length. */
  readonly path: string;
  /** What the boot answered with. */
  readonly boot: BootSnapshot;
  /** What the engine says it can do. See {@link DataPortCapabilities}. */
  readonly capabilities: DataPortCapabilities;
}

export interface LedgerScreenProps {
  /** The open ledger, or `null` before one has been chosen. */
  readonly ledger: OpenLedgerView | null;
  /** Set while the shell's chooser is up or a ledger is being read. */
  readonly busy: boolean;
  /**
   * What went wrong, verbatim.
   *
   * A refusal's message is the ledger's own prose and a fault's is the
   * transport's sentence. Either way it is shown as it is: seam rule 4 reaches
   * all the way out here, and rewording an engine's refusal in a component is
   * how a precise message becomes "something went wrong".
   */
  readonly problem: string | null;
  readonly onOpen: () => void;
  readonly onCreate: () => void;
}

const count = (n: number, one: string, many: string): string =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function LedgerScreen({
  ledger,
  busy,
  problem,
  onOpen,
  onCreate
}: LedgerScreenProps): ReactElement {
  if (ledger === null) {
    return (
      <main className="ledger-screen">
        <h1>WealthTracker</h1>
        <p>
          No ledger is open. Open one, or make a new one — it is a single file, and it stays on
          this machine.
        </p>
        {problem === null ? null : (
          <p role="alert" className="problem">
            {problem}
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={onOpen} disabled={busy}>
            Open a ledger…
          </button>
          <button type="button" onClick={onCreate} disabled={busy}>
            New ledger…
          </button>
        </div>
      </main>
    );
  }

  const { boot, capabilities } = ledger;
  return (
    <main className="ledger-screen">
      <h1>{ledger.path}</h1>
      <p>
        {count(boot.accounts.length, 'account', 'accounts')},{' '}
        {count(boot.transactions.length, 'transaction', 'transactions')},{' '}
        {count(boot.categories.length, 'category', 'categories')}. This ledger is open and this
        window holds it.
      </p>
      {/* The one sentence `capabilities` is here for, and it is COPY: `edition`
          may be rendered and never branched on (dataPort.ts states the rule and
          editionIsCopyOnly.test.ts greps for it). `backupTarget` is the capability
          the sentence is actually ABOUT, and branching on that is the point of
          having it — a person is owed a different sentence when the file in front
          of them is the only copy that exists. */}
      <p className="whose-copy">
        {capabilities.backupTarget === 'device'
          ? 'This file is the only copy. Back it up the way you back up anything else you cannot lose.'
          : 'A copy of these rows is held by your account as well as by this file.'}{' '}
        {capabilities.edition === 'device' ? 'Local edition.' : 'Cloud edition.'}
      </p>
    </main>
  );
}
