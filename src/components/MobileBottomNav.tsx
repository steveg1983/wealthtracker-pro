import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, WalletIcon, BarChart3Icon, CheckCircleIcon, TagIcon, PlusIcon, XIcon, SearchIcon } from './icons';

interface MobileNavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

/**
 * Five slots for the things you do on a phone. Budget and Goals used to hold
 * two of them: both are desk work — you sit down to plan, you don't plan in a
 * queue — and neither is something you reach for while standing in a shop.
 * Reconcile and Review are the opposite: they are the two chores that decide
 * whether the numbers can be trusted, and they are made of small decisions
 * that suit a phone. Budget and Goals keep their places in the menu.
 *
 * Home pointed at "/" until now, which is the public welcome page — a signed-in
 * user tapping Home got the marketing pitch. It points at the dashboard, which
 * is what the desktop nav has always meant by Home.
 *
 * Labels are 11px with no slot padding because that is what measurement said,
 * not taste: at 375px each of five slots gives the text 63px at 12px type, and
 * "Transactions" needed 72px — it rendered as "Transactio…" for as long as it
 * was here. At 11px with the padding removed every label fits whole. The full
 * word "Categorisation" does not fit at any size tried (83px), hence the verb,
 * which also matches "Reconcile".
 *
 * The third slot was Transactions, the global list, which is retired: on a
 * phone you either open the account you are looking at (Accounts) or you are
 * hunting for one row, which is Find. Nothing browses fifty thousand rows on a
 * phone, which is what that slot offered.
 */
const mobileNavItems: MobileNavItem[] = [
  { to: '/dashboard', icon: HomeIcon, label: 'Home' },
  { to: '/accounts', icon: WalletIcon, label: 'Accounts' },
  { to: '/find', icon: SearchIcon, label: 'Find' },
  { to: '/reconciliation', icon: CheckCircleIcon, label: 'Reconcile' },
  { to: '/categorisation', icon: TagIcon, label: 'Categorise' },
];

export default function MobileBottomNav(): React.JSX.Element {
  const location = useLocation();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Quick Actions Menu */}
      {showQuickActions && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowQuickActions(false)}
        >
          <div className="absolute bottom-20 right-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-2 min-w-[200px]">
            {/* The add-transaction modal is Layout's and is opened by an
                app-wide parameter, so this points at a page that still exists
                rather than at the retired list. `add-transaction`, not `add`:
                on /accounts the shorter word already means "add an account". */}
            <Link
              to="/accounts?action=add-transaction"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <BarChart3Icon size={20} />
              <span>Add Transaction</span>
            </Link>
            <Link
              to="/accounts?action=add"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => setShowQuickActions(false)}
            >
              <WalletIcon size={20} />
              <span>Add Account</span>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Action Button */}
      <button
        onClick={() => setShowQuickActions(!showQuickActions)}
        // Position via inline style, not utility classes: on the actual
        // device this button rendered at the LEFT edge while the same build
        // put it bottom-right in every desktop browser. An inline style is
        // beyond the reach of whatever ate the classes. Bottom rides the
        // safe-area inset the nav honours.
        className={`md:hidden fixed w-14 h-14 bg-primary dark:bg-[#1a2332] text-white rounded-full shadow-lg z-50 flex items-center justify-center transition-transform ${
          showQuickActions ? 'rotate-45' : ''
        }`}
        style={{ right: '1rem', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        aria-label="Quick actions"
      >
        {showQuickActions ? <XIcon size={24} /> : <PlusIcon size={24} />}
      </button>

      {/* safe-padding-bottom keeps the labels clear of the iPhone home
          indicator. The bar itself still runs to the physical bottom edge —
          padding, not margin — so the background reaches the screen edge the
          way a native tab bar does, and only the content is inset. The class
          has existed in index.css since the beginning and had never been used
          anywhere; with the status bar now translucent, the insets are ours to
          honour. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-padding-bottom"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center py-2 px-2 max-w-sm mx-auto">
        {mobileNavItems.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-2 rounded-lg transition-colors ${
                active
                  // `bg-nav-bg/10`, not `bg-primary/10`, and the difference is
                  // not cosmetic: `primary` is `var(--color-primary, #1a2332)`,
                  // and Tailwind 3 cannot apply an opacity modifier to a bare
                  // `var()` — it fails to parse it as a colour and emits NO
                  // RULE AT ALL. Compiled both to check: `bg-primary/10` is
                  // absent from the stylesheet, so it would have silently
                  // deleted the active state rather than tokenising it.
                  // `nav.bg` is the navigation family's own token and holds
                  // this exact navy as a literal, so `/10` compiles to the
                  // `rgb(26 35 50 / 0.1)` the hardcoded class was already
                  // producing — same pixels, named.
                  ? 'text-primary bg-nav-bg/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={22} />
                {/* Neutral, for `ActivityBadge`'s reason and in its palette:
                    this is a count of things not yet looked at, and expense
                    red on a count is the inversion corrected on Accounts and
                    on the reconciliation list. Nothing sets `badge` today, so
                    this is the shape the first caller will inherit — which is
                    exactly why it is worth being right now rather than later.

                    `> 0` rather than a bare `&&`: `{0 && …}` renders the
                    number, so a slot that genuinely had nothing waiting would
                    have printed a naked "0" beside its icon with no badge
                    around it. Zero counts render nothing. */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 bg-surface-tertiary text-slate-600 dark:bg-gray-700 dark:text-gray-300 text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 truncate max-w-full ${
                active ? 'font-medium' : 'font-normal'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}