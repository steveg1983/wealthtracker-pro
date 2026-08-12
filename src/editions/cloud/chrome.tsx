/**
 * `@chrome`, in a browser: the furniture as it has always been.
 *
 * The cloud half of the seam `editions/chrome.ts` declares, and the twin of
 * `desktop/editions/chrome.tsx`. Eight members: six typed re-bindings, one lazy
 * import and one three-line wrapper — no logic beyond that, for
 * `services/port/index.ts`'s reason: the CHOICE is the file.
 *
 * ── EVERY LINE HERE IS A LINE THAT USED TO BE IN Layout ─────────────────────
 *
 * Including the lazy one. `AddTransactionModal` was declared at the top of
 * `Layout.tsx` as `lazyWithRecovery(() => import('./AddTransactionModal'))` and
 * the declaration moved here whole, chunk and all, because a dynamic import is
 * an import: leaving it in Layout would have left `AppContextSupabase` reachable
 * from the frame in the one way that looks like it is not there.
 *
 * ── THE ANNOTATIONS ARE THE CHECK ───────────────────────────────────────────
 *
 * `editions/chrome.ts` declares the props Layout may pass; the components are
 * the real ones. Each `const X: ChromeY = Z` is therefore the compiler being
 * asked whether the shipped component still answers what the frame is written
 * to give it — which is the question a second frame would never have been asked.
 */

import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import { UserButton } from '@clerk/clerk-react';
import DemoModeIndicator from '../../components/DemoModeIndicator';
import EnhancedNotificationBell from '../../components/EnhancedNotificationBell';
import GlobalSearchComponent from '../../components/GlobalSearch';
import { MobileBreadcrumb as MobileBreadcrumbComponent } from '../../components/layout/Breadcrumbs';
import { RealtimeStatusDot } from '../../components/RealtimeStatusIndicator';
import { OfflineIndicator as PWAOfflineIndicatorComponent } from '../../components/pwa/OfflineIndicator';
import { QuickAddOfflineButton as QuickAddOfflineButtonComponent } from '../../components/pwa/QuickAddOfflineButton';
import { useAutoBankSync } from '../../hooks/useAutoBankSync';
import type {
  ChromeGlobalSearch,
  ChromeOrnament,
  ChromeQuickAddTransaction
} from '../chrome';

// ONE SPECIFIER, VALUES AND TYPES TOGETHER — the rule `services/port/index.ts`
// states for `@data`. Layout holds a `useRef<GlobalSearchHandle>`, and a frame
// that had to import its furniture from one door and the shape of that
// furniture from another would be a frame that knows there are two editions.
// `editions/__tests__/editionAliases.test.ts` requires both halves to answer
// for the same list.
export type {
  ChromeGlobalSearch,
  ChromeOrnament,
  ChromeQuickAddTransaction,
  GlobalSearchHandle,
  GlobalSearchProps,
  QuickAddTransactionProps
} from '../chrome';

/**
 * The signed-in person, and the menu that signs them out. Clerk's own button,
 * with the appearance this app gives it — which used to be written twice in
 * Layout, once for the desktop header and once for the phone's.
 */
export const IdentityMenu: ChromeOrnament = () => (
  <UserButton
    afterSignOutUrl="/"
    appearance={{
      elements: {
        avatarBox: 'w-8 h-8',
        userButtonPopoverCard: 'shadow-xl',
        userButtonPopoverActions: 'mt-2'
      }
    }}
  />
);

/**
 * The scheduled bank-feed refresh, as a component that draws nothing.
 *
 * A component rather than the hook itself so that every member of this seam is
 * one kind of thing — see `ChromeOrnament`. The hook is unchanged and still
 * lives in `hooks/useAutoBankSync.ts`.
 */
export const BackgroundWork: ChromeOrnament = () => {
  useAutoBankSync();
  return null;
};

/** The yellow "demo mode" banner, and the height it publishes. */
export const DemoBanner: ChromeOrnament = DemoModeIndicator;

/** The phone's back link, which names the account when the path is one. */
export const MobileBreadcrumb: ChromeOrnament = MobileBreadcrumbComponent;

/** The bell, and the count on it. */
export const NotificationBell: ChromeOrnament = EnhancedNotificationBell;

/** Whether this tab is hearing about changes made somewhere else. */
export const RealtimeDot: ChromeOrnament = RealtimeStatusDot;

/** The search box in the header, and its twin in the phone's drop-down. */
export const GlobalSearch: ChromeGlobalSearch = GlobalSearchComponent;

/** Alt+N, the phone's `+`, and `?action=add-transaction` on any page. */
export const QuickAddTransaction: ChromeQuickAddTransaction = lazyWithRecovery(
  () => import('../../components/AddTransactionModal')
);

/** How many writes are queued for a server this tab currently cannot reach. */
export const OfflineQueueIndicator: ChromeOrnament = PWAOfflineIndicatorComponent;

/** Write a transaction into that queue without a connection. */
export const OfflineQuickAdd: ChromeOrnament = QuickAddOfflineButtonComponent;
