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
 * ── WHAT IS DELIBERATELY NOT HERE YET ───────────────────────────────────────
 *
 * The app's own screens. `routes.ts`'s `AWAITING_THE_MOUNT` says what stands in
 * the way, in measurements rather than intentions — and the measurement changed
 * with the mount slice's first half. The five cloud roots reachable from
 * `components/Layout` are gone: four seams (`@chrome`, `@identity`,
 * `@prefs-store`, `@telemetry`) joined `@data`, and a walk from the frame now
 * reaches 65 modules and no cloud at all
 * (`__tests__/layoutIsDesktopClean.test.ts`).
 *
 * What is left is one context — `contexts/AppContextSupabase`, the web's state
 * layer, which twenty of the twenty-five owed pages reach — plus three pages with
 * a cloud import of their own. Two owed routes are already clean and are waiting
 * only for a `<Route>`. That is part 2, and this file is where it will land.
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
