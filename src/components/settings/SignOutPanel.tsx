/**
 * SignOutPanel — the way out, with a word on it.
 *
 * The app already had a sign-out and it was findable only if you already knew
 * where it was: `@chrome`'s `IdentityMenu`, which is Clerk's `UserButton`, a
 * 32px unlabelled avatar circle at the right of the mobile header. The owner
 * went looking for a way to sign out on his phone and could not find one. The
 * control was three inches from his thumb the whole time.
 *
 * That is the same class of failure as the row-action icons that were reverted
 * for being hover-only: a control nobody can identify is a control most people
 * never find. An avatar is a picture of a person, not a verb, and nothing about
 * it says what happens if you press it.
 *
 * So this does not replace the avatar — the header keeps it, and for somebody
 * who knows the convention it is the faster route. It gives the action a
 * findable home as well, on the page people actually go to when they want to
 * change who they are.
 *
 * ── WHY IT IS A PANEL ON A SEAM AND NOT A BUTTON ON THE PAGE ────────────────
 *
 * `pages/Settings.tsx` is mounted by BOTH editions — `src/desktop/routes.ts`
 * lists `settings` — and the device edition has no authentication at all.
 * There is no `ClerkProvider` in that build, so there is nobody to sign out and
 * nothing for a sign-out to talk to. Importing Clerk from the shared page would
 * fail four separate gates: the two import-graph walks, the bundle grep for the
 * literal word `clerk`, and the `vi.mock` throw at the foot of
 * `desktopPages.test.tsx`.
 *
 * `@service` is the seam for exactly this and says so itself —
 * `src/desktop/routes.ts`: *"The same three regions, one level DOWN, are
 * `@service` … A region excluded at the router and then smuggled back in as a
 * card on a settings page would be no exclusion at all."* `auth` is one of
 * those three regions; `/login` is excluded at the router; this is that region
 * one level down, on a settings page. It sits beside `DangerZone`, which is the
 * other `auth`-region member and lives one page over.
 *
 * The WHOLE panel is the seam's member — heading, copy and control together —
 * rather than the page drawing a card and the seam filling it. A device
 * edition that rendered an empty "Signed in" box with nothing in it would be
 * worse than one that renders nothing, which is the ruling
 * `desktop/editions/service.ts` already made about explaining absent features
 * to people who did not buy them.
 *
 * ── WHY IT IS QUIET ─────────────────────────────────────────────────────────
 *
 * Signing out is routine and reversible: you sign back in. It is not
 * destructive and it does not get destructive colour — that is `DangerZone`'s,
 * one page over, where it means something. A secondary outline button, which
 * is one of P7's four button roles, and the same one `EmptyState` uses for its
 * quieter remedy. No focus ring of its own; the app has exactly one, applied
 * globally, and `test/a11y/oneFocusRing.test.tsx` keeps it that way.
 */

import { useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

export default function SignOutPanel(): React.JSX.Element {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress;

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError(null);

    try {
      // The same call and the same destination as `DangerZone`'s, so however
      // a session ends it ends in one place: the public welcome page.
      await signOut({ redirectUrl: '/' });
    } catch {
      // A sign-out that fails silently leaves somebody believing they have
      // signed out on a machine where they have not — which is the one
      // outcome here that actually costs anything.
      setError('Sign out did not complete — please check your connection and try again.');
      setIsSigningOut(false);
    }
  };

  return (
    <section
      aria-labelledby="sign-out-heading"
      className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6"
    >
      <h2
        id="sign-out-heading"
        className="text-card font-semibold text-gray-900 dark:text-white"
      >
        Signed in
      </h2>
      {/* Naming the address is the other half of the fix. The complaint was
          that nothing on screen said who you were or how to stop being them;
          an avatar answered neither. When Clerk has not settled yet the
          sentence simply starts at the consequence rather than flashing a
          placeholder where an address will be. */}
      <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
        {email ? `You are signed in as ${email}. ` : ''}
        Signing out ends this session on this device. Nothing in your ledger
        changes, and you can sign back in with the same details.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-body text-expense dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => { void handleSignOut(); }}
        disabled={isSigningOut}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded border border-line-strong dark:border-gray-600 text-body font-medium text-gray-700 dark:text-gray-300 hover:bg-surface-secondary dark:hover:bg-gray-700 transition-colors duration-state disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </section>
  );
}
