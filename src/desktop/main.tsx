/**
 * THE DESKTOP ENTRY. The web app's is `src/main.tsx`; this is its opposite
 * number, and comparing the two is the shortest description of the edition.
 *
 *     src/main.tsx           zodConfig, security, Sentry, a service worker,
 *                            push notifications, a Clerk publishable key, a
 *                            ClerkProvider around <App/>
 *     src/desktop/main.tsx   find `invoke`, render <DesktopApp/>
 *
 * Nothing has been switched off to get from one to the other. The second list
 * is short because a program with no server has nothing to authenticate to, no
 * errors to post anywhere, no offline to be (it is a file), and nobody to send
 * a notification. Each of those absences is a module this bundle's import graph
 * cannot reach, which `__tests__/desktopEntry.cloudFree.test.ts` walks from
 * THIS FILE and `scripts/desktop-bundle-greps.mjs` measures in what is built.
 *
 * ── THE APP'S OWN SCREENS ARE HERE NOW ──────────────────────────────────────
 *
 * They were not, until the mount slice's second half, and the reason was always
 * a measurement rather than an intention. Slice 29: a walk from
 * `components/Layout` reached 144 modules and five cloud roots. The mount's
 * first half answered those with four seams and got the frame to zero. What was
 * left was one file — `contexts/AppContextSupabase`, which twenty of the
 * twenty-five owed pages reached — and a handful of billing and bank-feed
 * surfaces inside otherwise local pages.
 *
 * `@session` and `@service` are those two answers, and the walk from THIS FILE
 * now reaches 348 modules, thirty-seven routes and no cloud at all
 * (`__tests__/desktopEntry.cloudFree.test.ts`). Three routes remain owed and
 * `routes.ts` names the exact chain behind each.
 *
 * The list above is still short, and it is still short for the same reason:
 * nothing was switched off. `DesktopApp` renders a chooser, and the application
 * arrives — lazily, after a file is open, because `@data` resolves to a module
 * whose scope demands one — through `MountedLedger`.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopApp } from './DesktopApp';
import { tauriInvoke } from './tauriShell';
import './desktop.css';

const root = document.getElementById('root');
const invoke = tauriInvoke();

if (root === null) {
  // Unreachable through `index.html`, which is embedded in the binary beside
  // this script. Stated rather than asserted because the alternative to saying
  // so is a blank window.
  document.body.textContent = 'The window’s document is missing its root element.';
} else if (invoke === null) {
  // Opened in an ordinary browser rather than in the app: `dist/` is a
  // directory of files and can be served by anything. Worth a sentence, because
  // this bundle has no cloud in it at all, so "nothing happens" would be the
  // most confusing possible outcome.
  createRoot(root).render(
    <StrictMode>
      <main className="ledger-screen">
        <h1>This window is not the WealthTracker app</h1>
        <p>
          The desktop renderer only works inside the shell, which is what provides the ledger.
        </p>
      </main>
    </StrictMode>
  );
} else {
  createRoot(root).render(
    <StrictMode>
      <DesktopApp invoke={invoke} />
    </StrictMode>
  );
}
