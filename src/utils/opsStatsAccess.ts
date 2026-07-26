/**
 * Whether this signed-in user may read banking-ops stats at all.
 *
 * The endpoint is restricted to an explicit admin allowlist, so for everybody
 * else it answers 403 — every time, for the whole session. A badge already
 * hides itself on the first refusal, but that knowledge died with the
 * component: two badges mount on the Accounts page, so every visit spent two
 * round trips relearning the same "no". Holding it here outlives the mounts.
 *
 * Its own module rather than a second export from the component: a file that
 * exports both a component and a function loses React Fast Refresh for every
 * component in it.
 */

let forbidden = false;

/** True once the API has told us this user is not an ops admin. */
export function isOpsStatsForbidden(): boolean {
  return forbidden;
}

/** Record a 403 so no further component asks the same question this session. */
export function markOpsStatsForbidden(): void {
  forbidden = true;
}

/**
 * Clear the cached answer. For tests: module scope is what makes this outlive
 * a mount, and it therefore outlives a test case too, so each must reset it.
 */
export function resetOpsStatsAccess(): void {
  forbidden = false;
}
