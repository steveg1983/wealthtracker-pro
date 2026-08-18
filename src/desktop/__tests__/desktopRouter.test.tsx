/**
 * THE DESKTOP ROUTER'S DECISIONS, held to the web router.
 *
 * `routes.ts` says what every address in `src/App.tsx` means to a window:
 * mounted, never coming, or owed. This is what makes that manifest true rather
 * than aspirational — it reads `App.tsx` and fails if any route has no answer,
 * if an answer is given twice, or if a route that was decided against has crept
 * back in.
 *
 * ── WHY IT READS App.tsx AS TEXT ────────────────────────────────────────────
 *
 * Because the alternative is importing it, and importing `App.tsx` means
 * evaluating a ClerkProvider, a Supabase context and a Sentry boundary in order
 * to ask a question about a list of strings. The routes are `path="…"`
 * attributes; a regular expression is the right size of instrument for that,
 * and it fails in the direction that matters — a route written in some way this
 * cannot see is a route that is MISSING from the extraction, which shows up as
 * a manifest entry with nothing to answer, not as a route that slips through.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AWAITING_THE_MOUNT,
  DESKTOP_ROUTES,
  NEVER_ON_A_DESKTOP
} from '../routes';
import { DesktopApp } from '../DesktopApp';
import type { Invoke } from '../../services/local/coreTransport';

const APP = path.resolve(__dirname, '..', '..', 'App.tsx');

/** Every `path="…"` in the web router, verbatim. */
const webRoutes = (): string[] => {
  const source = readFileSync(APP, 'utf8');
  return [...new Set([...source.matchAll(/path="([^"]*)"/g)].map(match => match[1]))].sort();
};

const mounted = DESKTOP_ROUTES.map(route => route.path);
const excluded = NEVER_ON_A_DESKTOP.map(route => route.path);
const owed = AWAITING_THE_MOUNT.map(route => route.path);

/**
 * A shell that answers nothing.
 *
 * The router's decisions are the subject here, not the ledger, so `invoke`
 * never resolves: a promise that stays pending leaves the window on its first
 * screen, which is the state every assertion below is about. A rejection would
 * have been the other option and it would have put an error message on screen
 * for no reason connected to what is being tested.
 */
const silentShell: Invoke = () => new Promise(() => {});

describe('the desktop router', () => {
  it('has an answer for every route the web app has', () => {
    const answered = new Set([...mounted, ...excluded, ...owed]);
    const unanswered = webRoutes().filter(route => !answered.has(route));

    // Named rather than counted, because the fix is a decision: does this
    // address make sense in a window with no server, and if it does, what is
    // stopping it? Both answers go in routes.ts, next to the others.
    expect(
      unanswered,
      'These routes exist in src/App.tsx and src/desktop/routes.ts does not say what they mean ' +
        'on a desktop. Add each to DESKTOP_ROUTES, NEVER_ON_A_DESKTOP or AWAITING_THE_MOUNT.'
    ).toEqual([]);
  });

  it('answers each of them exactly once', () => {
    const seen = new Map<string, number>();
    for (const route of [...mounted, ...excluded, ...owed]) {
      seen.set(route, (seen.get(route) ?? 0) + 1);
    }
    const twice = [...seen].filter(([, count]) => count > 1).map(([route]) => route);

    // Two answers is worse than none: it is a route that is both excluded and
    // owed, and whichever list a reader happens to open is the one they will
    // believe.
    expect(twice).toEqual([]);
  });

  it('answers nothing the web app does not have', () => {
    // The manifest is a mirror of App.tsx, so an entry with no counterpart is
    // either a route that was deleted from the web app — in which case the
    // decision about it is dead — or a typo, which would silently leave the real
    // route unanswered while the count looked right. `/` is the one exception:
    // it is the window's own first screen, and it is a route in App.tsx too.
    const web = new Set(webRoutes());
    const orphans = [...mounted, ...excluded, ...owed].filter(route => !web.has(route));
    expect(orphans).toEqual([]);
  });

  it('mounts nothing that was decided against', () => {
    // THE GATE. Banking, subscription and auth are absent by decision, and this
    // is the assertion that stops one of them being mounted by somebody who did
    // not read why. Adding an excluded path to DESKTOP_ROUTES fails here, by
    // name, with the reason it was excluded.
    const smuggled = DESKTOP_ROUTES.filter(route =>
      NEVER_ON_A_DESKTOP.some(gate => gate.path === route.path)
    ).map(route => {
      const gate = NEVER_ON_A_DESKTOP.find(candidate => candidate.path === route.path);
      return `${route.path} — ${gate?.region}: ${gate?.why}`;
    });
    expect(smuggled).toEqual([]);
  });

  it('excludes all three regions the local edition does not have', () => {
    // The companion assertion: the rule above is vacuously satisfied by an
    // empty exclusion list. These three regions are the edition's definition,
    // and each has to have at least one route in it or something has been
    // quietly re-admitted.
    const regions = new Set(NEVER_ON_A_DESKTOP.map(route => route.region));
    expect(regions.has('banking')).toBe(true);
    expect(regions.has('subscription')).toBe(true);
    expect(regions.has('auth')).toBe(true);
  });

  it('gives a reason for every exclusion, and a measurement for every debt', () => {
    // A gate with no reason on it gets opened. A debt with no measurement on it
    // gets forgotten. Both are prose, so both are checked for being present and
    // being a sentence rather than a shrug.
    const thin = [
      ...NEVER_ON_A_DESKTOP.filter(route => route.why.length < 80).map(r => `why: ${r.path}`),
      ...AWAITING_THE_MOUNT.filter(route => route.blockedBy.length < 20).map(r => `blockedBy: ${r.path}`)
    ];
    expect(thin).toEqual([]);
  });

  it('gives every mounted route an address, and no two the same', () => {
    // `path` is App.tsx's token and `at` is where this window serves it, and the
    // second is not derivable from the first: nothing in `app` says it lives
    // under `settings`. Two routes at one address is a page nobody can reach —
    // react-router picks one by specificity and the other is simply absent, with
    // no error anywhere.
    const seen = new Map<string, string[]>();
    for (const route of DESKTOP_ROUTES) {
      seen.set(route.at, [...(seen.get(route.at) ?? []), route.path]);
    }
    const clashes = [...seen].filter(([, paths]) => paths.length > 1);
    expect(clashes).toEqual([]);
  });

  it('serves each address under the token it was copied from', () => {
    // The other half of the pair above: an `at` that has nothing to do with its
    // `path` is a typo the compiler cannot see, and it would put a page at an
    // address no menu item links to. Every address either IS its token or ends
    // with it as a whole segment — `settings/app` for `app`, `''` for `/`.
    const wrong = DESKTOP_ROUTES.filter(route => {
      if (route.path === '/') return route.at !== '';
      return route.at !== route.path && !route.at.endsWith(`/${route.path}`);
    }).map(route => `${route.path} is served at ${JSON.stringify(route.at)}`);
    expect(wrong).toEqual([]);
  });

  it('names every screen it mounts, so a title bar can say where you are', () => {
    // A window has no tab strip and no address bar. `MountedLedger` writes
    // `title` to `document.title` on every navigation, so a blank one is a
    // window that has declined to say which of its thirty screens is showing.
    const untitled = DESKTOP_ROUTES.filter(route => route.title.trim().length === 0);
    expect(untitled).toEqual([]);
  });

  it('mounts the pages, and owes nothing at all', () => {
    // The count is here to make a REMOVAL visible. Slice 29's router mounted one
    // route and every page in the product was owed behind a measurement; the
    // mount's second half answered all but three of them, and slice 31 answered
    // those. A change that quietly dropped a page would otherwise pass every
    // other assertion in this file.
    //
    // FORTY-ONE since `custom-reports` moved out of NEVER_ON_A_DESKTOP — the
    // first path ever to leave that list. `routes.ts` carries the argument; the
    // short version is that the premise ("a device edition has no plans") was
    // wrong rather than the reasoning, because a one-time purchase IS a plan and
    // its buyer is on it.
    //
    // FORTY-TWO now, and the two arrived together on 18 Aug because a page MOVED
    // rather than because one was added: "What I'm committed to" left the
    // reports gallery for its own address under Plan (`recurring-payments`),
    // and its old gallery address stayed behind as a redirect so a pin made
    // before the move still lands. Both are as local as the register they read
    // — detection reads the open file's rows, the verdicts live in the file's
    // own `suggestion_dismissals`.
    expect(mounted.length).toBe(42);

    // EMPTY, and the list is kept rather than deleted — `routes.ts` says why:
    // this is one of three ANSWERS a route can have, not an exception to a rule,
    // and `src/App.tsx` gains an address every few months. What this assertion
    // holds now is that nothing has JOINED it without a measurement, which is
    // the state the two answers below describe.
    expect(owed).toEqual([]);
  });

  it('shows the chooser, and sends an excluded address home', () => {
    // The manifest drives the router — `MountedLedger` maps over DESKTOP_ROUTES
    // — so a route cannot appear in this window without appearing in the list
    // the assertions above police. This is the pre-ledger half of that claim:
    // with no file open there is no router at all, because every address this
    // window serves is an address inside a ledger. The other half — the app
    // mounted, the money on screen — is `desktopPages.test.tsx`, which needs the
    // device seams and therefore its own config.
    window.location.hash = '#/open-banking';
    render(<DesktopApp invoke={silentShell} />);

    expect(screen.getByRole('heading', { name: 'WealthTracker' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open a ledger…' })).toBeInTheDocument();
    expect(screen.queryByText(/bank/i)).toBeNull();
  });
});
