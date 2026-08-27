/**
 * `@chrome`, on a device: four permanent absences, one real answer, and three
 * things this slice owes the next one.
 *
 * The device half of `editions/chrome.ts`, and the twin of
 * `editions/cloud/chrome.tsx`. It is worth reading the three groups apart,
 * because "renders nothing" means something different in each and only one of
 * them is unfinished work.
 *
 * ── ABSENT BY DECISION (they will never be anything else) ───────────────────
 *
 *   BackgroundWork    a bank feed needs a server holding a consent.
 *                     `NEVER_ON_A_DESKTOP` says so about the whole region; this
 *                     is the scheduler that region left behind in the frame.
 *   DemoBanner        demo mode is `?demo=true` on a hosted app — a way of
 *                     showing a stranger the product without giving them an
 *                     account. A program somebody installed and pointed at
 *                     their own file has no such question to answer.
 *   MobileBreadcrumb  a back link that exists because a PHONE has no room for a
 *                     trail. A window has room, and a title bar of its own.
 *   RealtimeDot       "am I hearing about changes made somewhere else" — and
 *                     there is nowhere else. `capabilities().realtime` is false
 *                     for the local port, for exactly the same reason.
 *   OfflineQueueIndicator  how many writes are waiting for a server to come
 *   OfflineQuickAdd        back, and a button that adds one more. There is no
 *                     server to be offline FROM: a device write lands in the
 *                     file before the button's ripple finishes. These two are
 *                     the mount slice's second half, and they were found by the
 *                     BUNDLE GREP rather than by the walk — both reach
 *                     `pwa/offline-storage`, which keeps its queue in IndexedDB,
 *                     and `indexedDBService` was not on the forbidden list until
 *                     the renderer that contains them was built and grepped.
 *
 * ── ANSWERED, FOR REAL ──────────────────────────────────────────────────────
 *
 *   IdentityMenu      the cloud's is a sign-out menu. This edition has no
 *                     sign-in to undo, so the honest answer to "who am I" is the
 *                     one `deviceIdentity.ts` gives: the ledger this window has
 *                     open.
 *
 * ── OWED, AND BLOCKED BY ONE THING ──────────────────────────────────────────
 *
 *   GlobalSearch      all three reach `contexts/AppContextSupabase`, the WEB's
 *   NotificationBell  state layer — not a page's fault and not this seam's to
 *   QuickAddTransaction  fix. They are what a device edition should have and
 *                     cannot have yet, and they are recorded as such in
 *                     `src/desktop/routes.ts`.
 *
 * They render nothing rather than something apologetic. A search box that
 * cannot search and says so is a worse thing to put in a header than a header
 * without a search box, and the window does not mount this frame yet anyway.
 */

import { forwardRef, useImperativeHandle, type ReactElement } from 'react';
import { currentDeviceIdentity } from '../../services/local/deviceIdentity';
import type {
  ChromeHasBankFeeds,
  ChromeHasPriceHistory,
  ChromeGlobalSearch,
  ChromeOrnament,
  ChromeQuickAddTransaction
} from '../../editions/chrome';

// The same list the cloud half re-exports, for the same reason: a specifier is
// only a substitution if both sides answer for the same vocabulary.
export type {
  ChromeHasBankFeeds,
  ChromeGlobalSearch,
  ChromeOrnament,
  ChromeQuickAddTransaction,
  GlobalSearchHandle,
  GlobalSearchProps,
  QuickAddTransactionProps
} from '../../editions/chrome';

/** The last segment of a path, for a window that has a file rather than a user. */
const fileName = (path: string): string => {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut === -1 ? path : path.slice(cut + 1);
};

/**
 * Whose ledger this window has open.
 *
 * Read at render rather than subscribed to, which is what `deviceIdentity.ts`
 * says the identity is for: it cannot change under a mounted tree, because
 * opening a different ledger replaces the document and re-boots the app against
 * it. `null` is the chooser — a window with no file open, which is the first
 * thing a desktop shows and is not an error.
 */
export const IdentityMenu: ChromeOrnament = () => {
  const identity = currentDeviceIdentity();
  if (identity === null) return null;
  return (
    <span
      className="text-sm text-white/80 max-w-[16rem] truncate"
      title={identity.path}
    >
      {fileName(identity.path)}
    </span>
  );
};

/** No feed to schedule. See the header's first group. */
export const BackgroundWork: ChromeOrnament = () => null;

/** No hosted demo to be in. */
export const DemoBanner: ChromeOrnament = () => null;

/** A window is not a phone. */
export const MobileBreadcrumb: ChromeOrnament = () => null;

/** Nowhere else for a change to be made. */
export const RealtimeDot: ChromeOrnament = () => null;

/** No notifications yet — the activity they count lives in the state layer. */
export const NotificationBell: ChromeOrnament = () => null;

/**
 * No search yet, but a REAL handle.
 *
 * The frame focuses this on Ctrl+K and on the phone's search button, through a
 * ref it holds. A twin that answered with a component ignoring `ref` would make
 * `desktopSearchRef.current` null and the shortcut a silent no-op with a
 * different cause. Answering the handle and doing nothing with it is the same
 * outcome and a legible one.
 */
export const GlobalSearch: ChromeGlobalSearch = forwardRef((_props, ref) => {
  useImperativeHandle(ref, () => ({ focusInput: (): void => {} }), []);
  return null;
});
GlobalSearch.displayName = 'GlobalSearch(device)';

/** No quick add yet — writing a transaction is the state layer's job. */
export const QuickAddTransaction: ChromeQuickAddTransaction = (): ReactElement | null => null;

/** No server to be offline from, so nothing is ever queued for one. */
export const OfflineQueueIndicator: ChromeOrnament = () => null;

/** …and nothing to add to the queue that is not there. */
export const OfflineQuickAdd: ChromeOrnament = () => null;

/** No server, no tokens, no sync — see editions/chrome.ts. */
export const CHROME_HAS_BANK_FEEDS: ChromeHasBankFeeds = false;

/**
 * The ledger file has no price-history table or verb yet — its own gated
 * lane in the Rust core, arriving with the manual-revalue flow. Until then
 * the import door is NOT PRINTED here (the bank-feeds lesson).
 */
export const CHROME_HAS_PRICE_HISTORY: ChromeHasPriceHistory = false;
