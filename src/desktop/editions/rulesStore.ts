/**
 * The device half of the seam `editions/rulesStore.ts` declares.
 *
 * There is no store, and that is the correct answer rather than a missing
 * feature. A desktop window is ONE machine, so "my rules follow me between
 * devices" solves a problem it does not have — and the ledger it works on is a
 * file on that machine, which is the promise the whole edition is built on.
 *
 * So rules stay where they have always been for this edition: local, applied
 * to every import, belonging to the machine. The engine that applies them is
 * `services/importRules/engine.ts`, shared with the cloud edition, so a rule
 * written here behaves exactly as the same rule would there.
 *
 * ── THE ONE THING WORTH REVISITING ──────────────────────────────────────────
 *
 * "Local" currently means the webview's own storage, not the open ledger file
 * — so rules are not inside the file the owner backs up or carries to another
 * machine. That is what ships today and it works; putting them in the document
 * instead is a small, separate piece of work, and it is written down here
 * rather than in a tracker because this is the file that would change.
 */
import type { DefaultRulesStore } from '../../editions/rulesStore';

/** The same list the cloud half re-exports. */
export type { DefaultRulesStore, RulesStore } from '../../editions/rulesStore';

export const defaultRulesStore: DefaultRulesStore = () => null;
