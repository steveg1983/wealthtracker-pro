/**
 * THE SHELL'S FURNITURE — the contract, named by neither edition.
 *
 * `components/Layout.tsx` is the frame every page of this product is drawn
 * inside: a nav, a header, a drawer, a bottom bar. Almost all of it is edition
 * blind already — links, icons, a page transition, a skip link — and the parts
 * that are not are all one kind of thing:
 *
 *   a piece of furniture that needs either THE CLOUD or THE APP'S STATE.
 *
 * That is what this seam covers, and the boundary is worth stating precisely
 * because it is not "the bits we have not done yet". Each name below reaches,
 * at import time, either a service a device does not have (a sign-in, a bank
 * feed, a realtime socket, a demo store) or `contexts/AppContextSupabase`, which
 * is the WEB's state layer and is itself a Phase-3 item. Nothing else in Layout
 * does, which is why nothing else in Layout is here.
 *
 * ── WHY THE FURNITURE AND NOT THE FRAME ─────────────────────────────────────
 *
 * The alternative was a second Layout for the device edition, and it is the
 * mistake this whole phase exists to avoid: two frames drift, and they drift in
 * the place a person looks at more than any other. A menu item added to one and
 * not the other is not a bug anybody files, it is an edition that is quietly
 * worse. So there is ONE Layout, and the six or seven things inside it that
 * cannot be one thing are named here and resolved by the build — exactly as
 * `@data` resolves an engine and `@telemetry` resolves a sink.
 *
 * ── WHAT THE DEVICE HALF OWES, AND WHEN ─────────────────────────────────────
 *
 * `desktop/editions/chrome.tsx` answers every name below, and today it answers
 * several of them with nothing at all. That is honest for this slice — the
 * window mounts no pages yet, so there is nothing for a search box to search —
 * and it is temporary: `src/desktop/routes.ts`'s `AWAITING_THE_MOUNT` records
 * which of them are waiting on the pages and which are waiting on the state
 * layer. A name whose device answer will always be nothing (the bank feed's
 * scheduler) says so in `NEVER_ON_A_DESKTOP` terms where it is declared.
 *
 * ── THE PROP TYPES ARE DECLARED HERE, NOT IMPORTED FROM THE COMPONENTS ──────
 *
 * `GlobalSearchProps` exists in `components/GlobalSearch.tsx` and would be
 * erased at build, so importing it would cost a desktop bundle nothing. The same
 * argument `services/local/preferencesTransport.ts` makes applies: the device
 * half would then NAME a module that reaches `AppContextSupabase`, and the next
 * person to widen this seam would read that as permission. Declaring them here
 * also makes the cloud half's annotation a real check — it is where the compiler
 * is asked whether the shipped component still matches what Layout may pass.
 */

import type { ComponentType, ForwardRefExoticComponent, RefAttributes } from 'react';

/**
 * A piece of furniture with nothing to configure. Most of them — including the
 * one that draws nothing at all.
 *
 * `BackgroundWork` is an ornament by this definition and it was very nearly a
 * hook instead, which would have been more honest about what it does (timers,
 * effects, no pixels) and worse in two ways: a module that exports both
 * components and hooks loses Fast Refresh for the components, and an edition
 * seam whose members are of two different KINDS is one a caller has to remember
 * the shape of. Everything here is a component, mounted in the frame's tree, and
 * one of them happens to render `null`.
 */
export type ChromeOrnament = ComponentType;

/** What the search box can be told. */
export interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onResultSelect?: () => void;
}

/**
 * What the frame can do TO the search box.
 *
 * Layout holds two of these — one for the header, one for the phone's
 * drop-down — and the keyboard shortcut focuses whichever the viewport says is
 * showing. So the handle is part of the contract rather than an implementation
 * detail of the web's component: an edition that answered with something
 * unfocusable would break a shortcut rather than a search.
 */
export interface GlobalSearchHandle {
  focusInput: () => void;
}

export type ChromeGlobalSearch = ForwardRefExoticComponent<
  GlobalSearchProps & RefAttributes<GlobalSearchHandle>
>;

/** What the app-wide "add a transaction" modal is told. */
export interface QuickAddTransactionProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The app-wide add-transaction modal.
 *
 * Typed as a plain component even though the web's is `React.lazy`, because
 * Layout renders it inside a `<Suspense>` either way and a lazy component is a
 * callable that answers the same props. An edition whose modal is NOT worth a
 * chunk of its own should not have to pretend otherwise.
 */
export type ChromeQuickAddTransaction = ComponentType<QuickAddTransactionProps>;

/**
 * WHETHER THIS EDITION HAS BANK FEEDS AT ALL — a fact, not furniture.
 *
 * The device edition's ledger is a file; there is no server to hold a bank
 * token, no cron to sync one, and never will be (the "NEVER_ON_A_DESKTOP"
 * class above). Yet the shared chrome offered "Bank Feeds" in its nav and
 * the Accounts page offered a "Bank connections" button, both opening
 * surfaces that could only apologise (owner, 26 Aug, item 4, from the first
 * real install). A control whose action cannot exist in this edition is not
 * furniture to stub — it is a menu item to NOT PRINT.
 *
 * A boolean rather than a stubbed component because the callers are not
 * mounting a thing, they are deciding whether to draw their OWN things (a
 * nav row, a toolbar button). The cloud half answers true, the device half
 * false, and the compiler holds both to this declaration.
 */
export type ChromeHasBankFeeds = boolean;
