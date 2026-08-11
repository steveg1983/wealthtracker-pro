/**
 * THE DESKTOP ENTRY IS CLOUD-FREE — asked of the module a bundler is pointed
 * at, rather than of the object graph underneath it.
 *
 * `services/local/__tests__/deviceDocument.cloudFree.test.ts` walks from the
 * DATA layer's root and has done since slice 27. That was the right root while
 * a desktop was a data layer and one screen of vanilla DOM. It is no longer the
 * whole story: this window now mounts React, a router and a component tree, and
 * every one of those is a place a cloud import can enter that `deviceDocument`
 * knows nothing about.
 *
 * So this walks from `src/desktop/main.tsx`, which is exactly what
 * `apps/desktop/vite.config.ts` builds, with `@data` resolved the way that
 * config resolves it. Between them the two tests cover both halves, and
 * `scripts/desktop-bundle-greps.mjs` then measures the artefact both describe.
 *
 * ── THE FORBIDDEN LIST IS LONGER HERE, AND ON PURPOSE ───────────────────────
 *
 * A data layer can only reach a Supabase client, a browser store or a logger.
 * A component tree can reach Clerk, Sentry, Stripe, the banking service and
 * `services/api/dataService` — the WEB's engine, which would arrive not by
 * anybody importing it but by a shared component importing
 * `services/port/index.ts` directly instead of `@data`. That last one is the
 * subtlest failure in this whole mechanism and the one the `no-restricted-
 * imports` rule in `eslint.config.js` exists to make loud.
 */

import { describe, expect, it } from 'vitest';
import { chainTo, walkFrom } from '../../services/local/__tests__/importGraph';

/**
 * `@data`, as `apps/desktop/vite.config.ts` resolves it.
 *
 * The walk has to be told, because the whole point of the alias is that the
 * source does not say. Pointing it at the DEVICE module here is what makes this
 * test a test of the desktop build rather than of some third thing.
 */
const DESKTOP_ALIAS = { '@data': 'services/local/deviceDataPort' };

/** What a desktop build may not contain, and what each one would cost. */
const FORBIDDEN_MODULES: ReadonlyArray<{ module: string; why: string }> = [
  {
    module: 'services/api/supabaseClient.ts',
    why: 'a Supabase client — the cloud, in a program that promises the file never leaves the machine'
  },
  {
    module: 'services/api/dataService.ts',
    why:
      "the WEB edition's engine. Reaching it means some module imported `services/port` by path " +
      'instead of `@data`, so this build is talking to Supabase and to a file at once'
  },
  {
    module: 'services/storageAdapter.ts',
    why: "the browser's IndexedDB store — a second copy of the ledger, on a device that already has one"
  },
  {
    module: 'loggers/scopedLogger.ts',
    why: 'the app’s logger, which reaches a cloud logging service'
  },
  {
    module: 'services/userIdService.ts',
    why: 'the Clerk↔database translator, in an edition where there is nothing to translate'
  },
  {
    module: 'contexts/AuthContext.tsx',
    why: 'a sign-in session, in an edition whose identity is the uuid inside the open file'
  },
  {
    module: 'contexts/SubscriptionContext.tsx',
    why: 'a billing state, in an edition that is not sold by subscription'
  }
];

/** And the packages, which a bundle would carry whole. */
const FORBIDDEN_PACKAGES: ReadonlyArray<{ specifier: string; why: string }> = [
  { specifier: '@clerk/clerk-react', why: 'a sign-in provider' },
  { specifier: '@supabase/supabase-js', why: 'a database client' },
  { specifier: '@sentry/react', why: 'error reporting to a server' },
  { specifier: '@stripe/stripe-js', why: 'payments' },
  { specifier: '@stripe/react-stripe-js', why: 'payments' }
];

describe('the desktop entry', () => {
  const graph = walkFrom(['desktop/main'], DESKTOP_ALIAS);

  it('reaches the window it is supposed to be', () => {
    // Checked before it is trusted, for the reason the walker's header gives: a
    // walk that resolved nothing would pass every assertion below.
    expect(graph.modules.has('desktop/DesktopApp.tsx')).toBe(true);
    expect(graph.modules.has('desktop/LedgerScreen.tsx')).toBe(true);
    expect(graph.modules.has('desktop/routes.ts')).toBe(true);
    expect(graph.modules.has('services/local/deviceDocument.ts')).toBe(true);
    expect(graph.modules.has('services/local/localDataPort.ts')).toBe(true);
    expect(graph.packages.has('react-dom/client')).toBe(true);
    expect(graph.packages.has('react-router-dom')).toBe(true);
  });

  for (const { module, why } of FORBIDDEN_MODULES) {
    it(`does not reach ${module}`, () => {
      const chain = chainTo(graph, module);
      expect(chain === null, chain === null ? '' : `A desktop build would contain ${why}.\n  ${chain}`).toBe(
        true
      );
    });
  }

  for (const { specifier, why } of FORBIDDEN_PACKAGES) {
    it(`does not reach ${specifier}`, () => {
      const chain = chainTo(graph, specifier);
      expect(chain === null, chain === null ? '' : `A desktop build would contain ${why}.\n  ${chain}`).toBe(
        true
      );
    });
  }

  it('names no Node built-in, because a WebView has none of them', () => {
    const offenders = [...graph.packages.keys()].filter(specifier => specifier.startsWith('node:'));
    expect(offenders).toEqual([]);
  });

  it('would notice — the same walk from the WEB entry finds the cloud', () => {
    // The proof that this instrument can fail. `src/main.tsx` is the web app's
    // entry and it reaches all of it; if this walk found nothing there either,
    // the walker would be broken rather than the desktop clean.
    const web = walkFrom(['main'], { '@data': 'services/port/index' });

    expect(web.packages.has('@clerk/clerk-react')).toBe(true);
    expect(web.modules.has('services/api/dataService.ts')).toBe(true);
    expect(web.modules.has('loggers/scopedLogger.ts')).toBe(true);
  });

  it('would notice — the alias is what decides, so pointing it at the web engine finds it', () => {
    // The single most valuable line in this file. The desktop's cloud-freedom
    // rests entirely on `@data` resolving to the device module: if
    // `apps/desktop/vite.config.ts` ever lost that mapping, the alias would fall
    // through to the web engine and this whole bundle would quietly gain a
    // Supabase client. Nothing in the source would look different.
    //
    // So the same walk is run with the alias pointed the WRONG way, and it is
    // required to find what the right way must not. (`AppContextSupabase` is
    // not mounted here yet, so today this reaches the engine through the
    // alias's own target rather than through a component — which is precisely
    // the mistake being modelled.)
    const misaliased = walkFrom(['desktop/main', 'services/port/index'], {
      '@data': 'services/port/index'
    });

    expect(misaliased.modules.has('services/api/dataService.ts')).toBe(true);
    expect(misaliased.modules.has('services/api/supabaseClient.ts')).toBe(true);
  });
});
