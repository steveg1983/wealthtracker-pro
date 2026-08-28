/**
 * WHERE IMPORT RULES LIVE — the contract, named by neither edition.
 *
 * The owner asked on 28 Aug for rules that follow him between devices, and
 * then asked the better question: *"can it be cloud based for the main app but
 * local for the local download version?"* This is that answer, and it is the
 * shape `editions/preferencesStore.ts` already uses for settings.
 *
 * ── WHY A SEAM AND NOT AN IMPORT ────────────────────────────────────────────
 *
 * The first attempt had `importRulesService` import the Supabase store
 * directly. The pre-commit gate refused it, and was right to: that service is
 * reachable from the desktop entry, so the import would have put a database
 * client, the browser storage adapter and the user-id service inside a program
 * whose whole promise is that the ledger file never leaves the machine.
 *
 * The desktop would never have CALLED any of it. The problem is that its
 * bundle would have CONTAINED it. Moving the choice behind a specifier the
 * build resolves is the entire fix — the service's behaviour is identical in
 * both editions, and one bundle stops carrying a cloud it would never use.
 *
 * ── WHAT `null` MEANS, BECAUSE IT IS NOT AN ERROR ───────────────────────────
 *
 * *"There is no store; this machine is the store."* A desktop window answers
 * that, and so does a signed-out browser and a demo session. Rules then behave
 * exactly as they always have — kept locally, applied to imports, belonging to
 * one machine. Which is the right answer for a desktop app: it IS one device,
 * so "follow me between devices" solves a problem it does not have.
 *
 * The RULES THEMSELVES are shared. `services/importRules/engine.ts` is one
 * file used by both editions, so a rule behaves identically wherever it runs;
 * only the cupboard it is kept in differs.
 */
import type { ImportRule } from '../types/importRules';

/**
 * A place rules are kept that outlives this browser.
 *
 * Identity is deliberately absent: whose rules these are is a question only a
 * cloud has, and it is answered inside the cloud half. The shared service must
 * stay ignorant of it — reaching identity from a desktop-reachable module is
 * one of the things the seam guard fails on.
 */
export interface RulesStore {
  list(): Promise<ImportRule[]>;
  insert(rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImportRule>;
  update(id: string, updates: Partial<Omit<ImportRule, 'id' | 'createdAt'>>): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * The store to use when nobody has said which — or `null` for "there is none".
 *
 * Called on every resolve rather than once at import, because the cloud's
 * answer depends on a client and a signed-in user that may not exist yet when
 * this module is first evaluated.
 */
export type DefaultRulesStore = () => RulesStore | null;
