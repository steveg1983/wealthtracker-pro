import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellIcon, TrendingUpIcon, CreditCardIcon, TargetIcon, PiggyBankIcon, CheckCircleIcon, InfoIcon, XIcon } from './icons';
import { useActivityTracking, ActivityItem } from '../hooks/useActivityTracking';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { carryDemoFlag } from '../utils/navigation';

interface ActivityGroup {
  date: string;
  items: ActivityItem[];
}

type FilterValue = ActivityItem['type'] | 'all';

export default function EnhancedNotificationBell(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activities,
    counts,
    markAsRead,
    markAllAsRead,
    clearActivities
  } = useActivityTracking();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [isOpen, setIsOpen] = useState(false);

  /*
   * THE PANEL IS PORTALLED, AND THEREFORE POSITIONED BY MEASUREMENT.
   *
   * The app's root <div> carries `isolation: isolate`, which makes the WHOLE
   * application one stacking context sitting at level 0 among <body>'s
   * children. Anything portalled to <body> with a positive z-index — the
   * PageTip at z-40, for one — paints above every piece of in-app chrome no
   * matter what z-index that chrome asks for. Measured 25 Aug: raising this
   * panel to z-9999, and its header to z-9999, changed nothing; the tip still
   * won at every overlapping pixel. z-index inside an isolated root cannot
   * reach outside it.
   *
   * So the panel joins <body> like the dialogs do — CrossCurrencyTransferDialog
   * names the same reason — and pays for it by having to position itself. It
   * hangs from the bell's own right edge so it still reads as belonging to the
   * bell, and is clamped to the viewport so a phone never gets it half off the
   * screen (measured `left: -9` at 375px before this).
   */
  const bellRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const placePanel = useCallback((): void => {
    const bell = bellRef.current;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    // The panel hangs from the bell's right edge — EXCEPT where doing so
    // would starve it. On a phone the bell has the search icon to its right,
    // so bell-anchoring cost 68px of a 375px screen and drew a 291px panel
    // beside 76px of nothing. Where the screen is the binding constraint the
    // panel takes the screen instead, and on a wide one it still reads as
    // belonging to the bell.
    // clientWidth, not innerWidth: it excludes the scrollbar (which is the
    // room a panel actually has) and it is the one that survives being read
    // in an embedded or freshly-resized frame, where innerWidth can still be
    // 0 — measured, and a 0 here computes a 2px-wide panel.
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    if (viewportWidth === 0) return;
    const wanted = Math.min(384, viewportWidth - 16);
    const fromBell = Math.round(viewportWidth - rect.right);
    setAnchor({
      top: Math.round(rect.bottom + 8),
      right: Math.max(8, Math.min(fromBell, viewportWidth - 8 - wanted)),
    });
  }, []);

  // Before paint, so the panel never appears at the wrong place for a frame.
  useLayoutEffect(() => {
    if (!isOpen) return;
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [isOpen, placePanel]);
  const [filter, setFilter] = useState<FilterValue>('all');
  // The pulse state, its three-second timer and the effect that drove them
  // went with the ping: a `setTimeout` whose only purpose was a removed
  // animation is a re-render on a schedule for nobody's benefit.
  // `getNewSinceLastCheck` went too — it had no other reader here, and the
  // hook still exports it for anything that wants "new since you last looked".

  const getFilteredActivities = (): ActivityItem[] => {
    // Filter out sync and system notifications - only show app-data notifications
    const appActivities = activities.filter(a => a.type !== 'sync' && a.type !== 'system');
    if (filter === 'all') return appActivities;
    return appActivities.filter(a => a.type === filter);
  };

  const groupActivitiesByDate = (): ActivityGroup[] => {
    const filtered = getFilteredActivities();
    const groups = new Map<string, ActivityItem[]>();
    
    filtered.forEach(activity => {
      const date = getDateGroup(activity.timestamp);
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(activity);
    });

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items
    }));
  };

  const getDateGroup = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      return 'This Week';
    } else {
      return 'Earlier';
    }
  };

  const getActivityIcon = (activity: ActivityItem): React.JSX.Element => {
    switch (activity.type) {
      case 'transaction':
        return <CreditCardIcon size={16} className="text-blue-500" />;
      case 'account':
        return <PiggyBankIcon size={16} className="text-blue-600" />;
      case 'budget':
        return <TargetIcon size={16} className="text-purple-500" />;
      case 'goal':
        return <TrendingUpIcon size={16} className="text-orange-500" />;
      case 'sync':
        return <CheckCircleIcon size={16} className="text-blue-600" />;
      case 'system':
        return <InfoIcon size={16} className="text-gray-500" />;
      default:
        return <BellIcon size={16} className="text-gray-500" />;
    }
  };

  const getActivityColor = (activity: ActivityItem): string => {
    if (!activity.read) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  /**
   * Open what the alert is about.
   *
   * The stored `actionUrl` is the whole payload — for a new transaction it is
   * the register deep link that names the account and the row, so the register
   * selects and centres it on arrival (see hooks/useActivityLogger). A URL
   * stored by an older build points at a list instead, and still works.
   *
   * The demo flag is added at CLICK time from the current location rather than
   * stored with the alert: whether this is a demo session is a fact about now,
   * not about the moment the alert was raised, and a jump inside one has to
   * land inside the same session.
   */
  const handleActivityClick = (activity: ActivityItem) => {
    markAsRead(activity.id);
    if (activity.actionUrl) {
      navigate(carryDemoFlag(activity.actionUrl, location.search));
      setIsOpen(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      clearActivities();
    }
  };

  const filterTabs: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: 'all', label: 'All', count: counts.total },
    { value: 'transaction', label: 'Transactions', count: counts.transactions },
    { value: 'account', label: 'Accounts', count: counts.accounts },
    { value: 'budget', label: 'Budgets', count: counts.budgets },
    { value: 'system', label: 'System', count: counts.system }
  ];

  return (
    <>
      {/* Notification Bell Button */}
      {/*
        THE BELL LIVES ON THE NAVY BAR, so it is painted for the navy bar.

        It was `text-gray-700` — #374151, a DARK grey — sitting on the header's
        #1a2332. Measured: 1.53:1, against the 3:1 WCAG asks of a non-text
        control, and the owner's report was the plain version of that number:
        "I still cant see the notification bell."

        `text-white/60`, and the hover, are copied from the Help button
        immediately to its right, which has been legible at 6.7:1 all along —
        so this is the header's own idiom rather than a new one. The hover
        background moves from `gray-100` (a light-mode fill, invisible here) to
        the same `white/10` its neighbour uses.

        It renders NOWHERE ELSE: Layout mounts it twice, both in this bar, and
        the desktop edition's chrome returns null for it.
      */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
        aria-label={`Notifications${counts.unread > 0 ? ` (${counts.unread} unread)` : ''}`}
      >
        <BellIcon size={20} />
        
        {/*
          Unread badge — a COUNT, so it is neutral (design ruling A, and the
          same correction already made to ActivityBadge, the reconciliation
          chips and the Accounts columns). It wore `bg-red-500`: expense red,
          the colour this app reserves for money going out, spent on "you have
          not read these yet". Forty-one unread notifications is not a warning,
          and a badge that shouts at every count leaves nothing louder for the
          one that should.

          Slate on white clears AA at this size; 600 weight rather than bold,
          because 700 is not in the type scale.
        */}
        {counts.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-surface-tertiary dark:bg-gray-700 text-slate-600 dark:text-gray-200 text-xs font-semibold rounded-full flex items-center justify-center">
            {counts.unread > 99 ? '99+' : counts.unread}
          </span>
        )}

        {/*
          No pulse. Motion is an attention-demand for the same reason colour
          is — the argument that took `animate-ping` off ActivityBadge — and a
          ring throbbing beside a count of unread items demands it for
          something nobody has to act on. The badge appearing is the news.
        */}
      </button>

      {/* Notification Panel — see the note on `bellRef` for why it portals. */}
      {isOpen && anchor !== null && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          {/*
            A COLUMN, NOT A FIXED BOX — measured 2026-08-25 on the owner's
            phone and reproduced at both widths.

            It was `w-96 max-h-[600px] overflow-hidden` with the list given a
            hard `maxHeight: 450px`. Header (139) + list (450) + footer (44)
            comes to 633, so `overflow-hidden` cut 33px off a 44px footer —
            "Clear all notifications" was three-quarters clipped at EVERY
            width, desktop included. That is why the owner reported no way to
            clear notifications on the phone: on a wide screen enough of it
            survived to know it was there.

            So the panel lays itself out instead of being told: a flex column
            whose list takes what is left (`flex-1 min-h-0`) and whose footer
            is a fixed row that cannot be squeezed out. `min-h-0` is not
            decoration — a flex item defaults to `min-height: auto` and
            refuses to shrink below its content, which is the same trap the
            app-wide `button { display: inline-flex }` rule sets.

            And 384px does not fit a 375px phone: measured `left: -9`, so the
            panel hung off the screen edge. Capped to the viewport.
          */}
          <div
            className="fixed z-[61] flex flex-col w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{
              top: anchor.top,
              right: anchor.right,
              // The room actually LEFT once the panel hangs from the bell —
              // not `100vw`, which is the whole screen and ignores the offset
              // the anchor already spent. Measured at 375px: the naive form
              // put the left edge at -60.
              maxWidth: `calc(100dvw - ${anchor.right + 8}px)`,
              // Whatever is left below the bell, keeping clear of the floating
              // bottom nav.
              maxHeight: `min(600px, calc(100vh - ${anchor.top + 96}px))`,
            }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {counts.unread > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs — WRAP, never a hidden horizontal scroll.

                  Measured at 375px: the row needed 354px and had 350, so
                  "System" was cut off with no scrollbar to say so, and the
                  five pills read as one squashed string. A horizontal scroll
                  nobody can see is a filter nobody can reach; two legible
                  lines cost one row of height and hide nothing. */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {filterTabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
                      filter === tab.value
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1 text-xs opacity-70">({tab.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity List — `min-h-0` is what lets it actually shrink. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {getFilteredActivities().length === 0 ? (
                <div className="p-8 text-center">
                  <BellIcon size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No notifications
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Your recent activity will appear here
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {groupActivitiesByDate().map(group => (
                    <div key={group.date} className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">
                        {group.date}
                      </h4>
                      
                      <div className="space-y-1">
                        {group.items.map(activity => (
                          <button
                            key={activity.id}
                            onClick={() => handleActivityClick(activity)}
                            className={`w-full p-3 rounded-lg border transition-all hover:shadow-sm text-left ${getActivityColor(activity)}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getActivityIcon(activity)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium text-gray-900 dark:text-white ${!activity.read ? 'font-semibold' : ''}`}>
                                  {activity.title}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                                  {activity.description}
                                </p>
                                {activity.amount !== undefined && (
                                  <p className={`text-sm font-medium mt-1 ${
                                    activity.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {formatCurrency(activity.amount)}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                </p>
                              </div>

                              {!activity.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {getFilteredActivities().length > 0 && (
              <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleClearAll}
                  className="w-full justify-center text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
