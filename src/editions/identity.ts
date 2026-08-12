/**
 * WHOSE SESSION THIS IS — the contract, named by neither edition.
 *
 * The smallest of the four seams and the one that took the most argument to
 * keep small.
 *
 * ── WHAT IT IS FOR, EXACTLY ─────────────────────────────────────────────────
 *
 * There is a class of thing this application keeps PER OWNER on the machine in
 * front of it: a notification feed, the last time that feed was looked at,
 * anything else that must never survive onto somebody else's session on a
 * shared device. On 2026-07-26 one of those was found live — one user's account
 * activity, with real account names and real balance movements, visible inside
 * another user's session on the same phone, because the key was flat.
 *
 * The fix was to scope every such key by the signed-in user, and the only way to
 * ask that question was `useUser()` from Clerk. Which is why a NAV BADGE — a
 * number on a menu item — reached a sign-in provider, and why it was the last
 * cloud root a walk from `components/Layout` could find.
 *
 * ── WHY IT IS A KEY AND NOT A USER ──────────────────────────────────────────
 *
 * A tempting seam here is `useUser(): { id, name, email, signOut }`, and it
 * would be wrong in a way that is hard to walk back. The two editions do not
 * have the same kind of answer:
 *
 *   a browser  a Clerk session — a person who signed in, can sign out, and may
 *              sign in as somebody else in this same tab a minute from now;
 *   a device   the uuid in the open file's one `users` row. Nobody signed in.
 *              Nobody can sign out. It changes only when a different FILE is
 *              opened, which re-boots the application against it.
 *
 * A seam that answered "the user" would have to invent a device user, and every
 * consumer would then be written against a fiction. So the seam answers the one
 * question both editions really have — *"what should I file this under?"* — and
 * nothing else. A surface that needs a name to print, or a way to sign out,
 * needs a different seam, and the honest time to add it is when a surface that
 * needs it is being mounted. `@chrome`'s `IdentityMenu` is the sign-out one, and
 * it is a component precisely so that neither edition has to describe the
 * other's idea of a person.
 *
 * ── THE VALUE IS OPAQUE, AND CALLERS MAY NOT PARSE IT ───────────────────────
 *
 * A browser's is `user_2abc…`; a device's is a uuid. Both are stable for as
 * long as the session is, both are unique to their owner, and NEITHER is a
 * database id — `services/userIdService.ts` is what turns the first into one and
 * a device has nothing to translate. Anything that needs to name a row asks the
 * data layer, which resolves its own owner (seam rule 1). This is for namespacing
 * this machine's own storage, and that is all it is for.
 */

/**
 * A stable string to file this session's local storage under, or `null` when
 * there is nobody to file it under yet.
 *
 * `null` is not a failure and not a loading state to be waited out: a public
 * page, a demo session and a desktop window showing the ledger chooser all
 * answer it, and every consumer's correct response is the one they already
 * have — keep it in memory and persist nothing.
 */
export type UseIdentityKey = () => string | null;
