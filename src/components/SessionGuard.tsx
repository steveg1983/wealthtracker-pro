import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

/**
 * THE THING THAT MAKES "SESSION TIMEOUT" TRUE.
 *
 * The dropdown on Security Settings has always stored a number, and until now
 * nothing read it: `securityService.checkSession()` and `updateLastActivity()`
 * were both written, both correct, and both never called. A person could set
 * "5 minutes", leave the app open for a week, and come back signed in.
 *
 * ─ WHY IT IS A COMPONENT AND WHY IT IS CLOUD-ONLY ──────────────────────────
 *
 * Signing out is a thing you can only do to somebody who is signed IN, which
 * is the cloud edition's whole business. A device window has no session to
 * end, so the desktop twin of this seam member is `() => null` — the same
 * argument that makes `SignOutPanel` cloud-only, one page up.
 *
 * It renders nothing. It exists to be MOUNTED, high enough that the timer
 * outlives any single page: put it beside the router, not inside a route, or
 * it restarts every time somebody navigates.
 */
export default function SessionGuard(): React.JSX.Element | null {
  const { signOut } = useAuth();

  useSessionTimeout(() => {
    // `redirectUrl` rather than leaving them on a page they can no longer
    // load: a timed-out session that stays on /accounts shows an empty ledger,
    // which reads as data loss rather than as a sign-out.
    void signOut({ redirectUrl: '/' });
  });

  return null;
}
