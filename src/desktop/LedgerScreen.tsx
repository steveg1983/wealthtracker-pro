/**
 * The first screen of a desktop window: "which ledger?".
 *
 * A browser opens on a sign-in. A window opens on a FILE CHOOSER, and that is
 * the whole of the difference the identity slice settled: the act that answers
 * "who are you" here is choosing a file, because the answer is the uuid inside
 * it.
 *
 * ── IT IS THE ONE SCREEN THAT EXISTS BEFORE THERE IS A PORT ─────────────────
 *
 * Everywhere else in this application the ledger arrives through `@data`. Not
 * here: this is what a person looks at while they decide which ledger to open,
 * and `services/local/deviceDataPort.ts` resolves `requireDeviceDocument()` in
 * its module scope — so a chooser that imported the seam could not be rendered
 * until the thing it is for had already happened. It takes no data at all now,
 * which is the simplest possible form of that rule.
 *
 * ── WHAT USED TO BE HERE, AND WHERE IT WENT ─────────────────────────────────
 *
 * A second arm: given an open ledger, it printed the account, transaction and
 * category counts and a sentence about where the file's only copy lives. It was
 * the whole of what a window could show before the mount, and it is
 * `MountedLedger`'s index screen now — where it reads those counts out of
 * `useApp()` like every other figure in the product, instead of out of a boot
 * snapshot read specially for it.
 */

import type { ReactElement } from 'react';

export interface LedgerChooserProps {
  /** Set while the shell's chooser is up or a ledger is being opened. */
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

export function LedgerChooser({
  busy,
  problem,
  onOpen,
  onCreate
}: LedgerChooserProps): ReactElement {
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
