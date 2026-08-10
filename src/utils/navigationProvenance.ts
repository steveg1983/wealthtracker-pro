/**
 * Provenance — where a drill-down came FROM, carried with it so the page it
 * lands on can offer the way back to the exact place it left.
 *
 * ONE mechanism for every jump in the app that used to strand somebody:
 * a dashboard chart into its full report, the duplicate sweep into the
 * register, a notification into an account. The page that starts the jump says
 * where it is and what the way back should be called; the page that receives
 * it renders that instead of its own default back-link. Nothing else changes.
 *
 * WHY location.state RATHER THAN A QUERY PARAM: provenance is about THIS
 * journey, not about the destination. A URL that carried it would be copied
 * into a chat message, bookmarked, and shared — and would then promise a
 * stranger a "Back to Find Duplicates" that means nothing to them. React
 * Router's state survives in-app navigation (including the back button, since
 * it is stored with the history entry) and is simply absent on a direct arrival
 * or a bookmark — which is exactly the condition for "show the default
 * back-link", and it costs no extra flag to detect.
 *
 * WHY IT IS PARSED, NOT TRUSTED: history state is JSON that outlives a deploy.
 * A user can be on a page whose history entry was written by last week's build,
 * so every read narrows the value rather than asserting a shape onto it — a
 * malformed or missing entry reads as "no provenance", which is the safe
 * default (the page's own back-link).
 */

/** Where a jump came from, and what the way back should say. */
export interface NavigationProvenance {
  /**
   * The path to return to, INCLUDING its search string — so a demo session,
   * an account filter or an open tab all come back as they were.
   */
  path: string;
  /**
   * The whole label, as the user reads it: "Back to Dashboard". Not a noun to
   * be assembled into a sentence at the far end, because the far end has no
   * idea whether the origin was a page, a dialog or a report.
   */
  label: string;
  /**
   * Crumbs the ORIGIN wrote for itself — whatever it needs handed back to
   * restore the state it was in (which dialog was open, which row was in
   * view). Opaque here on purpose: this module has no business knowing what a
   * duplicate sweep or a report needs, and each origin owns its own parser.
   */
  resume?: unknown;
}

/** The shape of `location.state` this mechanism reads and writes. */
export interface ProvenanceState {
  /** Set on the OUTBOUND jump: where the user came from. */
  from?: NavigationProvenance;
  /** Set on the RETURN jump: the crumbs the origin asked to be handed back. */
  resume?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Provenance describing the page the user is on right now.
 *
 * The path is taken from the live location rather than rebuilt from a route
 * constant, so whatever is in the query string — the demo flag, a filter, a
 * chosen tab — is part of the way back without anyone having to remember it.
 */
export function currentPageProvenance(
  location: { pathname: string; search: string },
  label: string,
  resume?: unknown
): NavigationProvenance {
  const path = `${location.pathname}${location.search}`;
  return resume === undefined ? { path, label } : { path, label, resume };
}

/** The `state` to hand to navigate()/Link on the outbound jump. */
export function withProvenance(from: NavigationProvenance): ProvenanceState {
  return { from };
}

/**
 * The `state` for the return jump: the origin's own crumbs, handed back to it.
 * `undefined` when there are none, so a return trip that needs no restoring
 * leaves a clean history entry rather than an empty object.
 */
export function returnState(from: NavigationProvenance): ProvenanceState | undefined {
  return from.resume === undefined ? undefined : { resume: from.resume };
}

/** The provenance in a location's state, or null for a direct arrival. */
export function readProvenance(state: unknown): NavigationProvenance | null {
  if (!isRecord(state)) return null;
  const from: unknown = state.from;
  if (!isRecord(from)) return null;
  const { path, label, resume } = from;
  if (typeof path !== 'string' || path === '') return null;
  if (typeof label !== 'string' || label === '') return null;
  return resume === undefined ? { path, label } : { path, label, resume };
}

/**
 * The crumbs handed back on a return trip, for the origin to parse. `undefined`
 * when this is not a return trip.
 */
export function readResumeCrumbs(state: unknown): unknown {
  if (!isRecord(state)) return undefined;
  return state.resume;
}
