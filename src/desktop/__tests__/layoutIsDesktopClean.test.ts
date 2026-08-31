/**
 * THE FRAME IS CLOUD-FREE — and this is the assertion the mount slice exists to
 * be able to make.
 *
 * ── THE NUMBER THIS FILE REPLACES ───────────────────────────────────────────
 *
 * Slice 29 set out to mount the app's own screens in the desktop window and
 * could not, and wrote down why as a measurement rather than an intention:
 *
 * > A runtime import walk from `components/Layout` reaches 144 modules and FIVE
 * > independent cloud roots, none of which is any page's own fault.
 *
 * Re-measured at the mount slice's base commit with the same instrument the
 * number was 141 modules, 17 packages and six roots — the sixth being one slice
 * 29's walker did not print, because a walk records the FIRST chain that reaches
 * a module and three more of Layout's own children reach `AppContextSupabase`
 * behind the breadcrumb that got the credit.
 *
 * The four seams (`@chrome`, `@identity`, `@prefs-store`, `@telemetry`) are what
 * this test is about, and what it asserts is that the number is now **zero**.
 * Nothing was deleted to achieve it: every one of those surfaces is still in the
 * web build, reached through the same frame, by the specifier's other half.
 *
 * ── WHY THIS IS A SECOND TEST AND NOT A SECOND ROOT IN THE FIRST ────────────
 *
 * `desktopEntry.cloudFree.test.ts` walks from `src/desktop/main.tsx` and asks
 * *"is what we BUILD clean?"*. Until the mount's second half that entry did not
 * reach Layout at all, and this file asked the different question — *"is the
 * frame READY to be built?"* — as the precondition part 2 depended on.
 *
 * Part 2 landed and the entry DOES reach the frame now, so the two roots
 * overlap. This one is kept anyway and it is not redundant: it is the only test
 * that isolates the FRAME, so when the entry's walk goes red it is the first
 * thing to run — a failure here means the frame; a failure only there means a
 * page. Both share one vocabulary (`editionWalk.ts`) so neither can drift from
 * the other.
 */

import { describe, expect, it } from 'vitest';
import { chainTo, walkFrom } from '../../services/local/__tests__/importGraph';
import {
  CLOUD_ALIAS,
  DEVICE_ALIAS,
  FORBIDDEN_MODULES,
  FORBIDDEN_PACKAGES
} from './editionWalk';

/**
 * The frame, and nothing else. Not `App.tsx`, which is the WEB router and has
 * a `ClerkProvider` in it by design — `src/desktop/MountedLedger.tsx` is that
 * file's opposite number and `routes.ts` is where the two are reconciled.
 */
const THE_FRAME = ['components/Layout'];

describe('the shared Layout, resolved for a device', () => {
  const graph = walkFrom(THE_FRAME, DEVICE_ALIAS);

  it('is the frame, and a real graph of it', () => {
    // Checked before it is trusted: a walk that resolved nothing would pass
    // every assertion below, and the seams make that failure MORE likely rather
    // than less — a mistyped alias target resolves to nothing at all.
    expect(graph.modules.has('components/Layout.tsx')).toBe(true);
    expect(graph.modules.has('desktop/editions/chrome.tsx')).toBe(true);
    expect(graph.modules.has('desktop/editions/telemetry.ts')).toBe(true);
    expect(graph.modules.has('desktop/editions/preferencesStore.ts')).toBe(true);
    expect(graph.modules.has('desktop/editions/identity.ts')).toBe(true);
    // The frame itself, not a stub of one: the nav, the page transition and
    // the logger are all still there and all still shared. (The settings
    // context used to stand here, but its only road into the DEVICE frame was
    // the offline-queue furniture's selector tree — when that furniture was
    // retired on 1 Sep 2026 the context rightly left this graph with it, and
    // a positive control must be a module the frame reaches on a road of its
    // own.)
    expect(graph.modules.has('components/layout/NavComponents.tsx')).toBe(true);
    expect(graph.modules.has('components/layout/SimplePageTransition.tsx')).toBe(true);
    expect(graph.modules.has('loggers/scopedLogger.ts')).toBe(true);
    // Three chapters now: 65 before the mount slice; 50 when two PWA surfaces
    // (an offline write queue and the button that fills it) joined `@chrome`
    // after the BUNDLE GREP found IndexedDB in a renderer this walk had
    // called clean; 34 measured since 1 Sep 2026, when that queue — which no
    // write path ever fed — was retired from both editions and took a
    // sixteen-module subtree with it. A floor rather than an equality,
    // because the number that matters is zero and it is asserted below —
    // this one only has to prove the walk resolved a real frame.
    expect(graph.modules.size).toBeGreaterThan(30);
  });

  for (const { module, why } of FORBIDDEN_MODULES) {
    it(`does not reach ${module}`, () => {
      const chain = chainTo(graph, module);
      expect(chain === null, chain === null ? '' : `Mounting the frame would bring ${why}.\n  ${chain}`).toBe(
        true
      );
    });
  }

  for (const { specifier, why } of FORBIDDEN_PACKAGES) {
    it(`does not reach ${specifier}`, () => {
      const chain = chainTo(graph, specifier);
      expect(chain === null, chain === null ? '' : `Mounting the frame would bring ${why}.\n  ${chain}`).toBe(
        true
      );
    });
  }

  it('names no Node built-in, because a WebView has none of them', () => {
    const offenders = [...graph.packages.keys()].filter(specifier => specifier.startsWith('node:'));
    expect(offenders).toEqual([]);
  });

  it('would notice — the SAME frame resolved for a browser reaches all of it', () => {
    // The proof that the seams are what did the work, and the most valuable
    // assertion in this file. One import map is the whole difference between
    // these two walks: same root, same source, same instrument. If this arm
    // ever stopped finding the cloud, the arm above would be passing because
    // the cloud had moved rather than because the frame was clean.
    const web = walkFrom(THE_FRAME, CLOUD_ALIAS);

    expect(chainTo(web, '@clerk/clerk-react')).not.toBeNull();
    expect(chainTo(web, '@supabase/supabase-js')).not.toBeNull();
    expect(chainTo(web, '@sentry/react')).not.toBeNull();
    expect(chainTo(web, 'contexts/AppContextSupabase.tsx')).not.toBeNull();
    expect(chainTo(web, 'services/storageAdapter.ts')).not.toBeNull();
    expect(chainTo(web, 'hooks/useAutoBankSync.ts')).not.toBeNull();
  });

  it('would notice — each seam alone is load-bearing', () => {
    // One seam at a time, pointed back at its cloud half with the other three
    // left device-side. Each must be enough on its own to put the cloud back in
    // the frame, which is what makes the four a set of four rather than one
    // that works and three that are decoration.
    const withCloud = (seam: string): ReturnType<typeof walkFrom> =>
      walkFrom(THE_FRAME, { ...DEVICE_ALIAS, [seam]: CLOUD_ALIAS[seam] });

    expect(chainTo(withCloud('@chrome'), '@clerk/clerk-react')).not.toBeNull();
    expect(chainTo(withCloud('@identity'), '@clerk/clerk-react')).not.toBeNull();
    expect(chainTo(withCloud('@prefs-store'), 'services/api/supabaseClient.ts')).not.toBeNull();
    expect(chainTo(withCloud('@telemetry'), 'lib/sentry.ts')).not.toBeNull();
  });
});
