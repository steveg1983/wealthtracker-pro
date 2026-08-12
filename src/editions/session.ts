/**
 * WHOSE LEDGER, AND IS IT READY — the contract, named by neither edition.
 *
 * The fifth seam, and the one the mount's second half exists for.
 *
 * ── THE MEASUREMENT THAT ASKED FOR IT ───────────────────────────────────────
 *
 * `contexts/AppContextSupabase.tsx` is the app's state layer: 2,258 lines, ~70
 * importers, and every ledger operation in it already goes through `@data`. A
 * runtime import walk from it, with a desktop's resolution, reached **48 modules
 * and four independent cloud roots**:
 *
 *     @clerk/clerk-react          `useUser()`, at the top of the provider
 *     services/userIdService      the Clerk↔database-uuid translator
 *     services/autoSyncService    a background push to a server
 *     utils/demoData              sample rows written into the browser store
 *
 * All four are in ONE contiguous region of ONE effect — the seventy lines
 * between *"is Clerk loaded?"* and *"read the ledger"*. Nothing else in the file
 * reaches a cloud at all. So this seam is not a division of the state layer; it
 * is the state layer's PREAMBLE, lifted out whole.
 *
 * ── WHY ONE SEAM AND NOT FOUR ───────────────────────────────────────────────
 *
 * Four roots looks like four seams, and it would have been four contracts, four
 * cloud halves, four device halves and twelve config mappings for what is
 * plainly one idea: *a browser has to find out who is asking before it can read
 * anything, and a device already knows because it opened a file.*
 *
 * The decisive argument is a type, though, not a count. Three of those four
 * steps need the Clerk USER — an id, an email, a first and last name, because
 * `ensureUserExists` may have to CREATE the row. A seam split four ways would
 * have to carry that user across itself, and `editions/identity.ts` has already
 * ruled on what that costs:
 *
 * > *"A seam that answered 'the user' would have to invent a device user, and
 * > every consumer would then be written against a fiction."*
 *
 * One seam whose hook returns a CLOSURE keeps the user entirely on the cloud
 * side. {@link EditionSession.prepare} is made by the cloud hook, which already
 * has the session in hand; nothing about a person ever crosses. That is the
 * whole reason this shape was chosen over four.
 *
 * ── WHY NOT SPLIT THE CONTEXT IN TWO ────────────────────────────────────────
 *
 * The other candidate was a shared core provider (state + CRUD over `@data`)
 * wrapped by a cloud provider that added Clerk, sync and demo, with the entry
 * choosing which to mount. It is wrong for a reason React decides rather than
 * taste: **child effects run before parent effects.** `src/App.tsx` has the
 * scar and the comment —
 *
 * > *"This effect runs after AppContext's — child effects go first — so seeding
 * > from here raced the very load that consumes it."*
 *
 * A cloud wrapper's `useEffect` would therefore resolve the login AFTER the core
 * had already tried to read the ledger. Making that work needs a handshake
 * through a second context, which is more machinery than the four lines it
 * replaces — and it leaves seventy importers with two providers to think about.
 * A hook called from inside the one effect has no ordering problem to solve.
 *
 * ── WHAT EACH EDITION ACTUALLY ANSWERS ──────────────────────────────────────
 *
 *   a browser   Clerk loads; the person's database row is ensured; the
 *               preferences document is bound to it; the offline queue is
 *               started; the engine is told who signed in. Signed OUT, the
 *               reverse: the cached history is dropped and the preferences are
 *               unbound, because the next session on this browser may be
 *               somebody else's.
 *   a device    nothing. The file was chosen, opened, seeded and attached before
 *               this tree existed — `src/desktop/DesktopApp.tsx` does it, and it
 *               has to, because `@data` resolves to a module whose scope demands
 *               an open document. There is no login to wait for and nobody to
 *               tidy up after.
 */

/**
 * What the preamble did, reported rather than assumed.
 *
 * A record rather than a bare boolean because the boot prints ONE timing line
 * in every environment, production included, and `auth 412ms · services 88ms`
 * is the half of it that names the network. `loadBoot` already answers this
 * shape (`BootSnapshot.phases`), so the call site merges two records rather
 * than learning a second idiom.
 */
export interface SessionPreamble {
  /**
   * Whether there is an owner, resolved, for the ledger to belong to.
   *
   * `false` is not a failure: a signed-out browser, a demo session and a window
   * showing its chooser all answer it, and every one of them still reads
   * whatever the store hands back to nobody. What it gates is the work that is
   * only meaningful for a resolved owner — the server-side balance figures.
   */
  readonly owner: boolean;
  /**
   * What each step cost, in whole milliseconds, in the order they ran.
   *
   * Merged into the boot's own phases by the caller. An edition with no preamble
   * answers with an empty record rather than with zeroes, because a zero is a
   * measurement and there was nothing to measure.
   */
  readonly phases: Readonly<Record<string, number>>;
}

/**
 * This edition's answer to *"whose ledger, and may I read it yet?"*.
 *
 * Returned whole from {@link UseEditionSession} and memoised by both halves, so
 * that its IDENTITY is the answer: the boot effect depends on this object and
 * on nothing else, and it re-runs exactly when the session changes. That is what
 * the cloud half's `[user, isLoaded]` dependency has always meant, said once
 * instead of at the call site.
 */
export interface EditionSession {
  /**
   * Has this edition settled who is asking? Nothing is read before it has.
   *
   * The browser's is Clerk's `isLoaded`, and reading first would mean reading as
   * nobody a moment before reading as somebody — two boots, the first of them
   * wrong. A device is settled from the first render: the file is already open.
   */
  readonly settled: boolean;
  /**
   * Is there somebody for the ledger to belong to?
   *
   * Distinct from {@link SessionPreamble.owner}, which is the answer AFTER the
   * preamble ran and can be `false` where this is `true` — a signed-in person
   * whose database row could not be resolved. This one is the cheap question
   * asked at render, and the realtime subscription is gated on it because the
   * machinery around that subscription costs something to set up.
   */
  readonly present: boolean;
  /**
   * Everything that must happen before the store can be read — and, when there
   * is nobody, everything that must be undone.
   *
   * One member for both directions on purpose. They are the two arms of one
   * branch in one edition and they are both empty in the other, so a second
   * member would be a name that exists to be `() => {}` on the only side that
   * ever calls it. The name says `prepare` and the contract says what preparing
   * means when the answer is nobody: leave nothing of the last person behind.
   *
   * IT MAY REJECT, and the caller must treat that as a failed boot rather than
   * as an owner it did not get. This is stated because the opposite rule was
   * tempting and would have been a behaviour change smuggled in as a move: these
   * lines were inside the boot's own `try` before the seam existed, so an auth
   * service that could not be reached has always produced *"Failed to load data.
   * Using offline mode."* and no read at all. A preamble that swallowed its own
   * failure would instead read the ledger as nobody and show an empty app to
   * somebody who is signed in.
   */
  readonly prepare: () => Promise<SessionPreamble>;
}

/**
 * The hook, and the seam's one export.
 *
 * A hook rather than a function because a browser's answer is REACTIVE — Clerk
 * resolves a frame or two after mount, and a sign-out happens under a tree that
 * is already up. A device's cannot change under a mounted tree at all
 * (`deviceIdentity.ts` says why), and it is a hook there only because its twin
 * must be one.
 */
export type UseEditionSession = () => EditionSession;
