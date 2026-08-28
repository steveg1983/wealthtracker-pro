/**
 * The cloud half of the seam `editions/rulesStore.ts` declares, and the twin of
 * `desktop/editions/rulesStore.ts`.
 *
 * One typed re-binding, for the reason `services/port/index.ts` is one line:
 * the CHOICE is the file, and a choosing file that also does work is a file
 * whose work only one edition gets. The work is in
 * `services/importRules/importRulesStore.ts`.
 *
 * `null` until someone is signed in — the same answer the device half gives
 * permanently, and the reason the shared service treats "no store" as ordinary
 * rather than broken. A signed-out browser and a demo session both land here.
 */
import { listRules, insertRule, updateRuleRow, deleteRuleRow } from '../../services/importRules/importRulesStore';
import { userIdService } from '../../services/userIdService';
import type { DefaultRulesStore } from '../rulesStore';

/** One specifier, values and types together. See `services/port/index.ts`. */
export type { DefaultRulesStore, RulesStore } from '../rulesStore';

export const defaultRulesStore: DefaultRulesStore = () => {
  if (!userIdService.getCurrentDatabaseUserId()) {
    return null;
  }
  return {
    list: listRules,
    insert: insertRule,
    update: updateRuleRow,
    remove: deleteRuleRow
  };
};
