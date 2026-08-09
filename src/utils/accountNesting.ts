/**
 * Investment↔cash pairing (the Microsoft Money model): an account whose
 * `parentAccountId` points at another loaded account belongs INSIDE that
 * account — the Accounts page renders it nested in the parent's card and
 * counts its balance toward the parent's band; the Investments page counts it
 * inside the portfolio line rather than beside it. It stays a full account in
 * both places (own register, transfers, reconciliation); only its placement
 * changes.
 *
 * One definition, several callers: the resolution rules below are the whole
 * answer to "where does this account's money belong", so two pages can never
 * disagree about what a paired account is worth.
 *
 * Two invariants every function here holds:
 *
 *  - A PARENT THAT IS NOT IN THE SET IS NO PARENT. The account lists these
 *    functions are given carry only the accounts in view (open ones, or one
 *    page's subset). A child whose parent has been closed must fall back to
 *    top-level, or it is in nobody's nested list and in no band — invisible,
 *    which for an account with money in it is the worst outcome available. A
 *    row pointing at ITSELF is the same case for the same reason.
 *
 *  - A CYCLE CANNOT HANG THE PAGE. `parent_account_id` is a plain column with
 *    no acyclicity constraint, so A→B→A is representable. Every walk carries
 *    the ancestors it has already seen and stops on the first repeat.
 */

/** The only two fields nesting depends on. */
export interface NestableAccount {
  id: string;
  parentAccountId?: string | null;
}

/** True when `parentAccountId` names another account that is actually present. */
function resolvedParentId<T extends NestableAccount>(
  account: T,
  byId: ReadonlyMap<string, T>
): string | undefined {
  const parentId = account.parentAccountId;
  if (!parentId || parentId === account.id || !byId.has(parentId)) return undefined;
  return parentId;
}

/**
 * parent id → its nested children, in the input order. Accounts with no
 * resolvable parent appear in no entry; a parent with no children has no key.
 */
export function buildChildrenByParent<T extends NestableAccount>(
  accounts: readonly T[]
): Map<string, T[]> {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const map = new Map<string, T[]>();
  for (const account of accounts) {
    const parentId = resolvedParentId(account, byId);
    if (parentId === undefined) continue;
    const list = map.get(parentId);
    if (list) list.push(account);
    else map.set(parentId, [account]);
  }
  return map;
}

/** The accounts that render as themselves — everything with no resolvable parent. */
export function selectTopLevelAccounts<T extends NestableAccount>(
  accounts: readonly T[]
): T[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  return accounts.filter(a => resolvedParentId(a, byId) === undefined);
}

/**
 * Every account → the id of the outermost ancestor its money counts toward
 * (itself, when it has no resolvable parent). Cycle-safe: the walk stops on an
 * ancestor already seen, returning the last account reached.
 */
export function buildTopLevelIdByAccountId<T extends NestableAccount>(
  accounts: readonly T[]
): Map<string, string> {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const resolve = (account: T): string => {
    const seen = new Set<string>([account.id]);
    let current = account;
    for (;;) {
      const parentId = resolvedParentId(current, byId);
      if (parentId === undefined || seen.has(parentId)) return current.id;
      const parent = byId.get(parentId);
      if (!parent) return current.id;
      seen.add(parentId);
      current = parent;
    }
  };
  return new Map(accounts.map(a => [a.id, resolve(a)]));
}

/**
 * Outermost-ancestor id → every account that counts toward it, INCLUDING that
 * account itself, in the input order. Each account appears in exactly one
 * group, which is what makes a total over the groups a total over the accounts.
 */
export function groupByTopLevelId<T extends NestableAccount>(
  accounts: readonly T[],
  topLevelIdByAccountId: ReadonlyMap<string, string>
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const account of accounts) {
    const rootId = topLevelIdByAccountId.get(account.id) ?? account.id;
    const list = map.get(rootId);
    if (list) list.push(account);
    else map.set(rootId, [account]);
  }
  return map;
}
