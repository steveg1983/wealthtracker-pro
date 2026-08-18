import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Through `@identity`, not through Clerk. The one thing this page wanted a
// session for is a KEY to namespace a stored setting by, which is precisely
// and only what that seam answers — see src/editions/identity.ts. It was the
// last cloud root a walk from this page could find once `@session` took the
// state layer's preamble away.
import { useIdentityKey } from '@identity';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  WalletIcon,
  PieChartIcon,
  SettingsIcon,
  XIcon,
  BarChart3Icon,
  CheckIcon
} from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { preserveDemoParam } from '../../utils/navigation';
import EmptyState from '../EmptyState';
import FilteredEmptyState from '../FilteredEmptyState';
import { TableSkeleton, type TableSkeletonColumn } from '../loading/TableSkeleton';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';
import EditTransactionModal from '../EditTransactionModal';
import IncomeExpenseBreakdownModal from '../IncomeExpenseBreakdownModal';
import { Modal, ModalBody } from '../common/Modal';
import PeriodBar from '../../components/PeriodBar';
import NetWorthSummary from '../../components/NetWorthSummary';
import AccountBreakdownModal, { type AccountBreakdownView } from '../../components/AccountBreakdownModal';
import { PERIOD_LABELS, usePeriod } from '../../hooks/usePeriod';
import { cardPeriodKey, useCardPeriod } from '../../hooks/useCardPeriod';
import {
  NetWorthWidget,
  IncomeExpenseTrendWidget,
  ExpenseCategoriesWidget,
  CustomReportWidget,
} from './reportWidgets/DashboardReportWidgets';
import DashboardWidgetCard from './reportWidgets/DashboardWidgetCard';
import CardPeriodControl from './reportWidgets/CardPeriodControl';
import { useReportDrill } from './reportWidgets/useReportDrill';
import { WIDGET_CHART_HEIGHT } from './reportWidgets/widgetChrome';
import { BUILT_IN_REPORTS, type PinnableReportId } from './reportWidgets/pinnableReports';
import { PieChart, BarChart, ResponsiveContainer } from '../charts/DashboardCharts';
import { categoricalColor, useCategoricalRamp } from '../charts/chartColors';
import { formatDecimal } from '../../utils/decimal-format';
import { toDecimal } from '../../utils/decimal';
import { expandSplitTransactions } from '../../utils/transactionSplits';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import { computeAccountBalances } from '../../utils/accountBalances';
import {
  ACCOUNT_DISTRIBUTION_REMAINDER_ID,
  buildAccountDistribution,
  type AccountDistributionEntry,
} from '../../utils/accountDistribution';
import { groupAccountsBySection } from '../../utils/accountGrouping';
import { swapPositions, moveBySteps, previewStep } from '../../utils/reorderList';
import { buildCategoryNameLookup } from '../../utils/categoryNames';
import { buildAttentionItems } from '../../utils/attentionItems';
import { loadAutoSyncPrefs } from '../../utils/bankAutoSync';
import { buildAccountBankLinks } from '../../hooks/accountBankLinks';
import { useBankConnectionSnapshot } from '@service';
import { preferences } from '../../services/preferencesService';

/**
 * Where this page remembers the window it is being read over.
 *
 * The ORIGINAL key, deliberately. The dashboard has had three period controls
 * at various times — one for Performance, one for each half of the reports box
 * — and this is the one that predates all of them, so collapsing back to a
 * single page-level control keeps the choice the user already made rather than
 * starting them somewhere new. (`dashboardReportsFlows` and
 * `dashboardPerformance` are no longer read; a stored value under either is
 * simply ignored.)
 */
const DASHBOARD_PERIOD_KEY = 'dashboardReports';

/**
 * The heading of the two-figure card, in one place because it is also the name
 * its period control announces and the name the report drill-through uses. The
 * STORAGE key stays `…pin.performance`: renaming a heading must not lose
 * anyone's pinned window, and the key is not something a user ever reads.
 *
 * NOT "Money in, money out", which was the first choice and is wrong in this
 * app specifically. Money moves in and out for reasons that are neither income
 * nor an expense — a revaluation, an account adjustment, a transfer between two
 * of your own accounts — and this card counts none of them: `bucketByCategoryDirection`
 * admits only rows whose CATEGORY says income or expense. A heading promising
 * every movement, over two figures that exclude three kinds of movement, would
 * be a number that does not add up to its own title.
 */
const INCOME_AND_EXPENSES_TITLE = 'Income and Expenses';

/**
 * What a balance card is shaped like, for the placeholder that waits in its
 * place (DESIGN_PASS §4).
 *
 * The card is `p-4` around two stacked lines on the left (name over
 * institution) and the figure on the right, so the placeholder gets the same
 * two tracks at the same height and the grid does not reflow when the real
 * cards land.
 */
const ACCOUNT_CARD_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { key: 'name', className: 'flex-1' },
  { key: 'balance', width: '7rem' },
];

/**
 * What a balance card measures. MEASURED in the running app at 1280px, not
 * added up from the classes: `p-4` over two short lines reads as 76px on
 * paper and is 120px in the DOM, and a placeholder at the paper figure would
 * let the page jump by a third of a card per row as the real ones land.
 */
const ACCOUNT_CARD_HEIGHT = 120;

/**
 * Improved Dashboard with better information hierarchy
 * Design principles:
 * 1. Progressive disclosure - show most important info first
 * 2. Visual hierarchy - use size, color, and spacing
 * 3. Actionable insights - every section leads somewhere
 * 4. Mobile-optimized - works great on all screen sizes
 */
export function ImprovedDashboard() {
  // `customReports` comes from the context because the picker below lists them
  // INLINE in a modal body — there is no await to put a fetch in, and this used
  // to be a synchronous `localStorage` read. They ride the boot snapshot now;
  // `BootSnapshot` argues why that is the shape rather than a per-component
  // fetch.
  const { accounts, transactions, transactionSplits, budgets, categories, customReports, serverBalances, isLoading } = useApp();
  const { formatCurrency: formatCurrencyWithSymbol, displayCurrency } = useCurrencyDecimal();
  const identityKey = useIdentityKey();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense' | null>(null);
  // A row in the breakdown list opens the full editor — check details, fix a
  // category — and the list re-derives live, so a re-categorised transaction
  // drops out of it immediately.
  const [editingBreakdownTxnId, setEditingBreakdownTxnId] = useState<string | null>(null);
  // Pinned reports: the user chooses which live reports show on the
  // Dashboard (built-ins + their custom reports). What matters is different
  // to different users.
  const [pinnedReports, setPinnedReports] = useState<PinnableReportId[]>(() => {
    try {
      const stored = JSON.parse(preferences.getItem('dashboardPinnedReports') ?? 'null');
      if (Array.isArray(stored)) return stored as PinnableReportId[];
    } catch { /* fall through to the default */ }
    return ['net-worth'];
  });
  const [showReportPicker, setShowReportPicker] = useState(false);
  /**
   * ONE clock for the whole page.
   *
   * There were three, in the same style, each governing only the section it
   * happened to sit in — so none of them declared what it covered and two of
   * them were feet apart on screen (DESIGN_PASS_2026-08 §3.4). A page-level bar
   * under the heading says what it governs by WHERE IT IS, which is the thing
   * the section-local pickers could not do at any size.
   *
   * Twelve months is the default because it is the window that reads on every
   * figure below: net worth over a single month is a dot, while income and
   * spending over a year is a perfectly ordinary question to ask. It is also
   * the default this storage key already had, so nobody's stored dashboard
   * moves underneath them.
   */
  const period = usePeriod(DASHBOARD_PERIOD_KEY, 'last-12-months');

  /**
   * …AND THE FOUR CARDS THAT MAY DECLARE THEMSELVES OUT OF IT.
   *
   * The page clock above is still the law, and it is still the default for
   * every one of these. What changed is that the law now has a stated
   * exception, because the owner hit the cost of not having one: all-time net
   * worth forced all-time income-vs-expenses, and a stock and a flow are
   * different lenses with different natural windows.
   *
   * These are the page's period CONSUMERS, and they are all of them. Net worth
   * summary, account distribution, key balances and the attention list read
   * today's balances; budget status reads a rolling thirty days on purpose;
   * a pinned custom report carries its own filters. None of those four can be
   * pinned, because none of them is being read over the page's window in the
   * first place — a period control on a card that ignores periods is the same
   * undeclared scope this whole design is against, pointed the other way.
   *
   * An unpinned card is handed `period` ITSELF, not a copy of it, so "follows
   * the page" needs nothing keeping it true. See hooks/useCardPeriod.
   */
  const netWorthCard = useCardPeriod(cardPeriodKey(DASHBOARD_PERIOD_KEY, 'net-worth'), period);
  const trendCard = useCardPeriod(cardPeriodKey(DASHBOARD_PERIOD_KEY, 'income-expense-trend'), period);
  const categoriesCard = useCardPeriod(cardPeriodKey(DASHBOARD_PERIOD_KEY, 'expense-categories'), period);

  /**
   * Performance can be LOCKED to Income vs Expenses, and is the only card that
   * can be locked to anything — because it is the only pair on this page that
   * measures one thing twice. Performance is the total of income and expenses
   * over a window; the trend chart is those two numbers month by month. A total
   * covering a different period from the chart of that total is a contradiction
   * rather than a preference.
   *
   * `trendCard.picker` rather than `trendCard`'s own window: the trend card may
   * itself be following the page, so the lock passes through whatever it has
   * resolved to. Set the chart to 12 months and the figures follow; put the
   * chart back on Default and the figures follow it back to the page bar.
   *
   * Offered only while the chart is actually ON the dashboard. Locking to a
   * card the owner has unpinned would tie these figures to a window nothing on
   * screen can show or change, so the partner is withheld and the card falls
   * back to the page — see useCardPeriod.
   */
  const trendIsOnDashboard = pinnedReports.includes('income-expense-trend');
  const performanceCard = useCardPeriod(
    cardPeriodKey(DASHBOARD_PERIOD_KEY, 'performance'),
    period,
    undefined,
    trendIsOnDashboard ? { picker: trendCard.picker, label: 'Income vs Expenses' } : undefined
  );
  const performancePeriod = performanceCard.picker;

  // The Account Distribution card lives here rather than in
  // DashboardReportWidgets, so it reaches for the same click-through as its
  // neighbours instead of growing a second one that drifts.
  const openReport = useReportDrill();

  const togglePinnedReport = (id: PinnableReportId): void => {
    setPinnedReports(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      preferences.setItem('dashboardPinnedReports', JSON.stringify(next));
      return next;
    });
  };
  
  // Which accounts the owner put on his own front page. A statement about HIS
  // accounts, so it travels with the account rather than with this browser.
  useEffect(() => {
    try {
      const saved = preferences.getItem('dashboardKeyAccounts');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        setSelectedAccountIds(parsed);
        return;
      }
    } catch {
      preferences.removeItem('dashboardKeyAccounts');
    }
    // Default to showing first 4 accounts
    setSelectedAccountIds(accounts.slice(0, 4).map(a => a.id));
  }, [accounts]);

  // Real balance = openingBalance + Σ transactions, computed in ONE pass over
  // the whole transaction set. The previous per-account filters were
  // O(accounts × transactions) and ran up to five times per account —
  // ~50 MILLION Decimal operations per render on a 50k-row dataset. While the
  // transaction pages are still streaming in, the server's one-round-trip
  // balances stand in (see computeAccountBalances).
  /**
   * Which summary figure is opened out into its accounts — the same
   * AccountBreakdownModal the Accounts page drills with (owner, 16 August:
   * "make the 'what you own' and 'what you owe' clickable"). Rows are fed
   * from the SAME accountBalanceMap the tiles sum, so the modal's total and
   * the tile cannot disagree.
   */
  const [breakdownView, setBreakdownView] = useState<AccountBreakdownView | null>(null);

  const accountBalanceMap = useMemo(
    () => computeAccountBalances(accounts, transactions, serverBalances),
    [accounts, transactions, serverBalances]
  );

  // Calculate key metrics — all money sums use Decimal arithmetic (float math
  // is banned on currency values; IEEE-754 drifts on long sums).
  const metrics = useMemo(() => {
    const effectiveBalance = (acc: typeof accounts[0]): number => accountBalanceMap.get(acc.id) ?? 0;

    const totalAssets = accounts
      .filter(acc => effectiveBalance(acc) > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(effectiveBalance(acc))), toDecimal(0))
      .toNumber();

    const totalLiabilities = accounts
      .filter(acc => effectiveBalance(acc) < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(effectiveBalance(acc)).abs()), toDecimal(0))
      .toNumber();

    const netWorth = toDecimal(totalAssets).minus(toDecimal(totalLiabilities)).toNumber();

    // Budget progress reads the last 30 days — a rolling month of spending,
    // deliberately independent of the Performance card's chosen period.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = transactions.filter(t =>
      new Date(t.date) >= thirtyDaysAgo
    );

    // Calculate budget status for active budgets
    const activeBudgets = budgets.filter(b => b.isActive);
    
    // Split parents expand into per-line rows so a split line spends
    // against ITS category's budget. Money-style netting: a refund filed to
    // the budget's category REDUCES spend (refunds arrive as income-typed
    // rows, so there is deliberately no type filter — only transfers skip).
    const recentExpanded = expandSplitTransactions(recentTransactions, transactionSplits);
    const categoryNameFor = buildCategoryNameLookup(categories);
    const budgetStatus = activeBudgets.map(budget => {
      const categoryTransactions = recentExpanded.filter(t =>
        t.category === budget.categoryId && t.type !== 'transfer'
      );
      const netSpent = categoryTransactions.reduce(
        (sum, t) => sum.minus(toDecimal(t.amount)), toDecimal(0));
      const spent = netSpent.isNegative() ? 0 : netSpent.toNumber();
      const remaining = toDecimal(budget.amount).minus(toDecimal(spent)).toNumber();
      const percentUsed = budget.amount > 0
        ? toDecimal(spent).dividedBy(toDecimal(budget.amount)).times(100).toNumber()
        : 0;

      return {
        ...budget,
        // The budget's own category, NAMED. It was rendering `categoryId`
        // straight onto the screen — three raw UUIDs down the dashboard where
        // "Food & Drink" belongs — which is precisely what
        // `buildCategoryNameLookup` exists to prevent, in its own words: "a raw
        // category id must never reach a screen." Resolved once here so the
        // label, the group's aria-label and the progress bar's all say the same
        // thing.
        categoryName: categoryNameFor(budget.categoryId),
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budget.amount
      };
    });

    const totalBudgeted = activeBudgets.reduce((sum, b) => sum.plus(toDecimal(b.amount)), toDecimal(0)).toNumber();
    const totalSpentOnBudgets = budgetStatus.reduce((sum, b) => sum.plus(toDecimal(b.spent)), toDecimal(0)).toNumber();
    const overallBudgetPercent = totalBudgeted > 0
      ? toDecimal(totalSpentOnBudgets).dividedBy(toDecimal(totalBudgeted)).times(100).toNumber()
      : 0;
    
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      budgetStatus,
      totalBudgeted,
      totalSpentOnBudgets,
      overallBudgetPercent
    };
  }, [accounts, accountBalanceMap, transactions, transactionSplits, budgets, categories]);

  // Performance figures for the SELECTED period. Income/expenses come from
  // CATEGORY SEMANTICS (utils/incomeExpense): a refund filed under an expense
  // category is an expense credit that reduces spending — direction of
  // movement never decides the bucket. The cards and the breakdown modal read
  // these same totals, so both always describe one and the same window.
  const performance = useMemo(() => {
    const { from, to } = performancePeriod.range;
    const flows = computeIncomeExpense(transactions, transactionSplits, categories, {
      from: from ?? undefined,
      to: to ?? undefined,
    });
    return {
      income: flows.income.toNumber(),
      expenses: flows.expenses.toNumber(),
      incomeRows: flows.incomeRows,
      expenseRows: flows.expenseRows,
    };
  }, [transactions, transactionSplits, categories, performancePeriod.range]);

  // Generate net worth data for chart - ONLY REAL DATA
  const netWorthData = useMemo(() => {
    // Only show current month's actual data
    // In the future, this will pull from historical snapshots
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // For now, we only have current data
    // As the user uses the app over time, we'll build up historical data
    return [{
      month: currentMonth,
      netWorth: metrics.netWorth
    }];
  }, [metrics.netWorth]);
  
  const getAccountBalance = useCallback((acc: typeof accounts[0]) => accountBalanceMap.get(acc.id) ?? 0, [accountBalanceMap]);

  // Bank-feed facts for the attention card, read from the connections the app
  // has ALREADY loaded (Layout's auto-sync hook owns the fetching). A signed-out
  // or demo session has none, so no feed row can appear there.
  const bankConnections = useBankConnectionSnapshot();
  const bankLinks = useMemo(() => buildAccountBankLinks(bankConnections), [bankConnections]);
  const autoSyncMode = useMemo(
    () => (identityKey ? loadAutoSyncPrefs(identityKey).mode : 'off'),
    [identityKey]
  );

  // Every warning the card shows, each one a sentence saying why. `now` is
  // captured with the rest of the inputs: the staleness verdict changes when
  // the connections do, not on every render.
  const attentionItems = useMemo(
    () => buildAttentionItems({
      accounts,
      balanceOf: (id) => accountBalanceMap.get(id) ?? 0,
      linkOf: (id) => bankLinks.get(id),
      autoSyncMode,
      formatMoney: formatCurrencyWithSymbol,
      now: new Date(),
    }),
    [accounts, accountBalanceMap, bankLinks, autoSyncMode, formatCurrencyWithSymbol]
  );

  // Account distribution — the SAME ranking the full report draws (see
  // utils/accountDistribution). The card shows the slices a donut can carry;
  // the report behind it lists every account.
  const distribution = useMemo(
    () => buildAccountDistribution(accounts, id => accountBalanceMap.get(id) ?? 0),
    [accounts, accountBalanceMap]
  );
  const pieData = distribution.slices;

  // The shared ramp, not a fourth copy of the recharts demo palette that used
  // to live here (and, byte for byte, in two other files).
  const chartRamp = useCategoricalRamp();
  // No tooltip styles declared here any more: the DashboardCharts wrappers
  // default to the house style, which WATCHES the dark class. The block this
  // replaces read it once at render — a chart mounted before dusk kept its
  // light tooltip all evening (the exact read-once trap chartColors warns
  // about, living on this page).

  const persistSelection = useCallback((ids: string[]) => {
    preferences.setItem('dashboardKeyAccounts', JSON.stringify(ids));
    setSelectedAccountIds(ids);
  }, []);

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds(prev => {
      const newSelection = prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId];

      preferences.setItem('dashboardKeyAccounts', JSON.stringify(newSelection));
      return newSelection;
    });
  };

  /**
   * THE STORED ORDER IS THE DISPLAY ORDER (owner, 17 Aug: "move it within
   * that box … like moving an app around on an iPhone screen"). This used to
   * filter the ACCOUNTS array, so the tiles sat in load order whatever the
   * user chose — the id list the picker already persists simply becomes the
   * seating plan.
   */
  /**
   * ─ DRAGGING A TILE TO A NEW SEAT ──────────────────────────────────────────
   * Pointer events, one set for mouse, pen and touch. A press is not a drag
   * until it has moved 8px — the tile is also a button that opens the
   * account, and the moved flag is what keeps one gesture from being both.
   *
   * THE SEMANTICS ARE A SWAP, PREVIEWED, COMMITTED ON RELEASE (owner,
   * 18 Aug). The first cut re-seated the stored order live as the pointer
   * crossed each tile, so a drag from top-right to bottom-left displaced
   * every tile it crossed — "it is too easy to move the wrong one". Now:
   * the tile under the pointer previews sliding into the dragged tile's
   * ORIGINAL seat — computed fresh from the pre-drag order on every move,
   * never cumulatively, so a tile merely crossed springs back the moment
   * the pointer moves on — and NOTHING is stored until the button is
   * released. Escape-by-pointercancel reverts to where things were.
   *
   * THE PREVIEW HAS HYSTERESIS (owner, 18 Aug, on the first cut of the swap:
   * "the highlight quickly jumps back and forth between the moved from and
   * the moved to"). The flap was geometric: previewing a swap moves the
   * DRAGGED tile into the seat under the pointer, so the next move finds the
   * dragged tile there, cleared the preview, found the target again, swapped
   * again — every frame. So a preview now only CHANGES when the pointer
   * reaches a genuinely new tile. The dragged tile under the pointer is the
   * swap holding steady; a grid gap keeps the last preview; and the partner
   * tile under the pointer means the pointer is back at the ORIGIN seat —
   * the swap moved the partner there — which is a drag home, and reverts.
   *
   * ON A PHONE, PRESS AND HOLD LIFTS THE TILE (owner, 18 Aug: "if we hold
   * down for a few seconds, like on an iphone app on the iphone screen, can
   * it then 'loosen itself' to be swapped before leaving go of the screen?").
   * Exactly that: `touch-action: pan-y` leaves the page scrollable from a
   * tile, so a touch drag has no way to BE a drag — the browser claims any
   * movement as a scroll and cancels the pointer. A hold that stays within
   * the slop for {@link TOUCH_LIFT_MS} lifts the tile instead: from that
   * moment a non-passive touchmove listener refuses the scroll claim, the
   * finger owns the tile, and the same swap-preview-commit flow runs. Before
   * the lift, movement cancels the hold and the page scrolls as normal.
   * Alt+arrows cover the keyboard.
   */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const dragRef = React.useRef<{
    id: string; startX: number; startY: number; moved: boolean;
    /** The seating plan as the drag began — every preview derives from THIS. */
    baseOrder: string[];
    /** The tile currently previewing into the dragged tile's seat. */
    hoverId: string | null;
    /** Touch only: the press-and-hold timer, until it fires or moves away. */
    holdTimer: ReturnType<typeof setTimeout> | null;
    /** Touch only: the hold completed — the tile is loosened and draggable. */
    lifted: boolean;
    pointerType: string;
  } | null>(null);
  /**
   * The scroll refusal, held so it can be removed from wherever the gesture
   * ends. Non-passive deliberately: preventDefault on touchmove is the one
   * thing that stops a browser mid-gesture from claiming the pan, and a
   * passive listener is not allowed to say it.
   */
  const touchBlockRef = React.useRef<((ev: TouchEvent) => void) | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');

  const displayedAccounts = useMemo(() => {
    const byId = new Map(accounts.map(a => [a.id, a]));
    return (previewOrder ?? selectedAccountIds)
      .map(id => byId.get(id))
      .filter((a): a is typeof accounts[number] => a !== undefined);
  }, [accounts, selectedAccountIds, previewOrder]);

  const announceSeat = useCallback((accountId: string, order: string[]): void => {
    const name = accounts.find(a => a.id === accountId)?.name ?? 'Account';
    setReorderAnnouncement(`${name} moved to position ${order.indexOf(accountId) + 1} of ${order.length}`);
  }, [accounts]);

  /** How long a touch must hold still before the tile loosens. */
  const TOUCH_LIFT_MS = 450;

  /** Undo the lift's scroll refusal and hold timer, from any ending. */
  const releaseTouchHold = (): void => {
    const drag = dragRef.current;
    if (drag?.holdTimer !== null && drag?.holdTimer !== undefined) {
      clearTimeout(drag.holdTimer);
      drag.holdTimer = null;
    }
    if (touchBlockRef.current) {
      window.removeEventListener('touchmove', touchBlockRef.current);
      touchBlockRef.current = null;
    }
  };

  const handleTilePointerDown = (e: React.PointerEvent, accountId: string): void => {
    if (e.button !== 0) return;
    const drag = {
      id: accountId, startX: e.clientX, startY: e.clientY, moved: false,
      baseOrder: selectedAccountIds, hoverId: null,
      holdTimer: null as ReturnType<typeof setTimeout> | null,
      lifted: false,
      pointerType: e.pointerType,
    };
    dragRef.current = drag;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      // The hold. It only fires if the finger stayed within the slop — a
      // finger that moved is scrolling, and the move handler cancels this.
      drag.holdTimer = setTimeout(() => {
        if (dragRef.current !== drag) return;
        drag.holdTimer = null;
        drag.lifted = true;
        drag.moved = true;
        setDraggingId(drag.id);
        // From here the finger owns the tile: refuse the browser's claim on
        // the pan. Possible at all because nothing has moved yet — a pan
        // already underway could not be refused.
        const block = (ev: TouchEvent): void => ev.preventDefault();
        touchBlockRef.current = block;
        window.addEventListener('touchmove', block, { passive: false });
      }, TOUCH_LIFT_MS);
    }
  };

  const handleTilePointerMove = (e: React.PointerEvent): void => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerType === 'touch' && !drag.lifted) {
      // Not loosened yet: a finger that moves is scrolling, not dragging.
      // Cancel the hold and let the browser have the gesture.
      if (drag.holdTimer !== null &&
          Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 8) {
        clearTimeout(drag.holdTimer);
        drag.holdTimer = null;
      }
      return;
    }
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 8) return;
      drag.moved = true;
      setDraggingId(drag.id);
    }
    // The captured element receives every move, so the tile under the pointer
    // is found by position rather than by event target.
    const over = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-account-tile-id]');
    const targetId = over?.dataset.accountTileId ?? null;
    // The anti-judder rule lives in utils/reorderList (previewStep), pure and
    // pinned there — this handler only carries out its answer.
    const step = previewStep(targetId, drag.id, drag.hoverId);
    if (step.kind === 'keep') return;
    if (step.kind === 'revert') {
      drag.hoverId = null;
      setPreviewOrder(null);
      return;
    }
    drag.hoverId = step.targetId;
    // Always from the base order — never cumulative.
    setPreviewOrder(swapPositions(drag.baseOrder, drag.id, step.targetId));
  };

  const endTileDrag = (): void => {
    releaseTouchHold();
    const drag = dragRef.current;
    if (drag?.moved && drag.hoverId && drag.hoverId !== drag.id) {
      // THE COMMIT — the one moment the stored order changes.
      const final = swapPositions(drag.baseOrder, drag.id, drag.hoverId);
      persistSelection(final);
      announceSeat(drag.id, final);
    }
    setPreviewOrder(null);
    setDraggingId(null);
    // The moved flag must outlive pointerup by one tick: the click event the
    // browser fires AFTER a drag's release is the one to swallow.
    setTimeout(() => { dragRef.current = null; }, 0);
  };

  /** A cancelled drag (pointercancel — a scroll won the touch) commits nothing. */
  const cancelTileDrag = (): void => {
    releaseTouchHold();
    setPreviewOrder(null);
    setDraggingId(null);
    setTimeout(() => { dragRef.current = null; }, 0);
  };

  // A component that unmounts mid-lift must not leave the page unscrollable.
  useEffect(() => () => {
    if (touchBlockRef.current) {
      window.removeEventListener('touchmove', touchBlockRef.current);
      touchBlockRef.current = null;
    }
  }, []);

  /** Alt+arrows re-seat from the keyboard; plain keys keep their meanings. */
  const handleTileKeyDown = (e: React.KeyboardEvent, accountId: string): void => {
    if (!e.altKey) return;
    const steps =
      e.key === 'ArrowLeft' ? -1 :
      e.key === 'ArrowRight' ? 1 :
      e.key === 'ArrowUp' ? -2 :
      e.key === 'ArrowDown' ? 2 : 0;
    if (steps === 0) return;
    e.preventDefault();
    const next = moveBySteps(selectedAccountIds, accountId, steps);
    persistSelection(next);
    announceSeat(accountId, next);
  };

  /**
   * "None yet" and "none arrived yet" are different sentences, and the panel
   * below was only able to say the first (DESIGN_PASS §4).
   *
   * A first-run empty state is a welcome; the same words during a cold boot are
   * a false report that the user's accounts are gone. So while the load is
   * running the panel shows the shape of the cards instead — and shows nothing
   * at all until 200ms have passed, because a placeholder that flashes makes a
   * fast dashboard look like a slow one (useDelayedFlag).
   */
  const accountsStillArriving = isLoading && accounts.length === 0;
  const showAccountSkeleton = useDelayedFlag(accountsStillArriving);

  // The "which accounts to show here" picker, banded and alphabetised the way
  // every account list in the app is. It is not a <select>, so it cannot take
  // optgroups — it takes the same grouping in its own idiom instead, because
  // a sixty-account grid in load order is the same wall of names a flat
  // dropdown is.
  const accountSections = useMemo(() => groupAccountsBySection(accounts), [accounts]);

  // "All" means every account the panel below LISTS — taken from the sections
  // themselves rather than the accounts array, so the two can never disagree
  // about what the user just asked for.
  const selectAllAccounts = useCallback(
    () => persistSelection(accountSections.flatMap(section => section.accounts.map(a => a.id))),
    [accountSections, persistSelection]
  );
  const clearAllAccounts = useCallback(() => persistSelection([]), [persistSelection]);

  // Which pinned reports belong to which column: what you are worth on the
  // left, what moved on the right. A layout split, not a period one — both
  // columns read over the page's period.
  const assetsReports = pinnedReports.filter(id => id === 'net-worth');
  const flowsReports = pinnedReports.filter(
    id => id === 'income-expense-trend' || id === 'expense-categories'
  );
  const customPinnedReports = pinnedReports.filter(id => id.startsWith('custom:'));
  // A column with nothing in it is not drawn — an empty half of a two-column
  // grid is a hole, not a layout. Account Distribution is ALWAYS one of its
  // contents now (see the card itself), so this no longer turns on whether
  // there is data to draw.
  const showAssetsColumn = true;
  const showFlowsColumn = flowsReports.length > 0;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* The one control that says what window this page is being read over.
          Directly under the page heading, so its position states its scope. */}
      <PeriodBar picker={period} label="Period for this dashboard" />

      {/* Net worth and the two figures it is made of — one card, three
          columns. The navy slab this replaces put a second heavy horizontal
          under the nav bar and needed a whole white-on-navy text system to
          itself; the figure was already the largest thing on the page without
          it. See components/NetWorthSummary. */}
      <section
        data-testid="dashboard-grid"
        aria-label="Net worth, assets and liabilities"
      >
        <NetWorthSummary
          netWorth={formatCurrencyWithSymbol(metrics.netWorth)}
          assets={formatCurrencyWithSymbol(metrics.totalAssets)}
          liabilities={formatCurrencyWithSymbol(metrics.totalLiabilities)}
          onSelect={figure => setBreakdownView(figure)}
        />
      </section>

      {/* WHAT CAME IN AND WHAT WENT OUT, over the chosen period.
          Called "Performance" until 2026-08-13, which measured nothing:
          performance is a return against something — a benchmark, a target, a
          previous period — and this card holds two totals and compares them to
          nothing at all. "Money in, money out" is what the two figures are, and
          it cannot be misread as the Income vs Expenses chart it can now be
          locked to, which "Income and expenses" would have been.

          Reads over the page's period like everything else below the bar, until
          it is pinned or locked — and then it says "pinned · …" or "locked · …"
          instead of the bare window name, because the same words in the same
          place would no longer be saying the same thing. */}
      <section
        aria-labelledby="performance-heading"
        className="group/card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 id="performance-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
            {INCOME_AND_EXPENSES_TITLE}
          </h3>
          {!performanceCard.pin.isPinned && (
            <span className="text-body text-gray-500 dark:text-gray-400">
              {PERIOD_LABELS[performancePeriod.period]}
            </span>
          )}
          <CardPeriodControl
            cardLabel={INCOME_AND_EXPENSES_TITLE}
            picker={performancePeriod}
            pin={performanceCard.pin}
          />
        </div>

        {/* ─ NO TINTED GROUND (Claude Design §2, and §2.5 before it) ────────
            These were `bg-green-50` and `bg-red-50` side by side. The figures
            are already green and red; the tint said the same thing a second
            time, in the one place P2 reserves for meaning. The card surface
            and a hairline between them do the separating now.

            ─ THE ARROWS: A DIRECTION, NOT A TREND ───────────────────────────
            Design's §1 asked for these to go on an empty ledger, on the
            grounds that they render from a default rather than from a
            computed change and so claim a trend that does not exist.

            Half applied, deliberately. The owner asked for these two
            explicitly — "keep the up arrow and down arrow in the income and
            expenses boxes" — when the decorative glyphs came off this page,
            and he is right that they are not decoration: up is money coming
            IN and down is money going OUT, which is a direction, and the
            app's own rule permits the hues on directions.

            What Design is right about is the ZERO. £0.00 has no direction to
            point in, so on a fresh ledger the arrow was the only thing on the
            card making a claim. It is hidden at zero and shown otherwise —
            which is the same rule this app already applies to colour on a
            zero, now applied to the arrow beside it.

            NOT made into a change-vs-previous-period indicator, which is what
            §1 literally asks for. That is a different feature (it needs a
            prior period, and a number for the change) and it would silently
            re-point an arrow the owner asked to keep. Raised in the handover
            rather than assumed. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-0 sm:divide-x sm:divide-gray-200 sm:dark:divide-gray-700">
          {/* THE ARROW SITS WITH ITS FIGURE (Design, 17 Aug §2.5). It is a
              modifier on the amount — `justify-between` was parking it at the
              card's far edge, six hundred pixels from the number it modifies,
              with half a card of nothing connecting them. After the amount,
              same baseline. */}
          {/* `flex-col` is LOAD-BEARING, not layout tidiness: index.css sets
              `button { display: inline-flex }` globally, and a grid child
              blockifies that to flex — ROW direction — so without it the
              label and the figure sit side by side and the whole card reads
              shrunken (the owner caught it within a day; the fifth casualty
              of that global rule). */}
          <button
            type="button"
            onClick={() => setBreakdownType('income')}
            className="flex flex-col items-start p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer text-left"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
            {/* NEUTRAL AT ZERO (Design §4), on the reasoning that settled
                the arrow beside it: at zero there is no direction, so the
                direction signal must not render. A green £0.00 beside a
                red £0.00 says "money came in" and "money went out" on a
                ledger where neither happened — in the two hues the app
                reserves for exactly that claim. Same condition as the arrow,
                deliberately. */}
            <p className={`flex items-center gap-2 text-xl font-bold ${
              performance.income === 0
                ? 'text-gray-900 dark:text-white'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {formatCurrencyWithSymbol(performance.income)}
              {performance.income !== 0 && (
                <TrendingUpIcon size={20} className="text-green-500 flex-shrink-0" aria-hidden="true" />
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setBreakdownType('expense')}
            className="flex flex-col items-start p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer text-left"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
            <p className={`flex items-center gap-2 text-xl font-bold ${
              performance.expenses === 0
                ? 'text-gray-900 dark:text-white'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrencyWithSymbol(performance.expenses)}
              {performance.expenses !== 0 && (
                <TrendingDownIcon size={20} className="text-red-500 flex-shrink-0" aria-hidden="true" />
              )}
            </p>
          </button>
        </div>
      </section>

      {/* Pinned reports: the user's choice of live reports, at a glance.
          Same shared maths as the full Reports hub — the glance and the full
          view can never disagree.

          NOT A CARD. "Your Reports" is a section heading, and the report cards
          below are cards — wrapping them in one more card put two borders and
          two shadows around every chart (P7, §3.4). It stays a <section> with
          an accessible name, which is what makes it a landmark; only the box
          around it is gone.

          Both columns read over the page's period now. They used to carry a
          picker each, feet apart and identical in style to the one on
          Performance above them. */}
      <section aria-labelledby="pinned-reports-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 id="pinned-reports-heading" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Your Reports
          </h3>
          <button
            type="button"
            onClick={() => setShowReportPicker(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Choose which reports appear here"
            aria-label="Choose reports"
          >
            <SettingsIcon size={18} />
          </button>
        </div>

        {/* One column on a phone (they stack in this order), two from lg —
            and only two when there is something in both. */}
        <div className={`grid grid-cols-1 gap-6 ${showAssetsColumn && showFlowsColumn ? 'lg:grid-cols-2' : ''}`}>
          {showAssetsColumn && (
            <div className="space-y-4">
              {assetsReports.map(id => (
                <NetWorthWidget key={id} picker={netWorthCard.picker} pin={netWorthCard.pin} />
              ))}

              {/* Account distribution: a snapshot of TODAY, sitting under a
                  period control it deliberately ignores — so it says so.
                  There is no "distribution last March" to show: the balances
                  are what the accounts hold now.

                  The title opens the full report (every account, not five);
                  each legend row still opens ITS account's transactions.

                  No period travels with that click, deliberately: the report
                  states none of its own, and sending one would move the window
                  the NEXT report opens on from a control the destination does
                  not even show. The way back travels — see useReportDrill. */}
              {/* ALWAYS RENDERED, empty or not. It used to disappear when
                  there were no balances to draw, which on a fresh ledger left
                  the left column blank beside two cards on the right — the
                  owner read that as a chart that had failed, not as one with
                  nothing to say. His ruling: "It should still be shown, but
                  just with zero data, like the others."

                  What is shown when empty is a SENTENCE, not an empty ring.
                  Claude Design's §3 asks for exactly that and gives the reason:
                  an axis (or a ring) with nothing on it asserts there is
                  something to plot and reads as a failed load. The two rulings
                  agree once separated — the owner is asking for the CARD to be
                  present, Design is asking for the FRAME not to be. */}
              {(
                <DashboardWidgetCard
                  title="Account Distribution"
                  subtitle={
                    <>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {/* THE LEGEND SUMS TO NET WORTH (owner, 17 Aug). The
                            in-credit fold's legend totalled far more than net
                            worth — gross investments and loans-out counted,
                            liabilities ignored — "otherwise it looks like a
                            useless report". The remainder now nets EVERY other
                            account, and the words say what the shape claims.
                            When that net remainder is below zero the ring
                            cannot draw it (a pie has no negative wedge), so
                            the subtitle says where the rest went instead. */}
                        {pieData.length === 0
                          ? 'Your largest accounts by balance'
                          : distribution.foldedCount > 0
                            ? (pieData[pieData.length - 1].value >= 0
                              ? `Your top ${pieData.length - 1} accounts and the other ${distribution.foldedCount}, net — together, your net worth`
                              : `Your top ${pieData.length - 1} accounts — the other ${distribution.foldedCount} net below zero`)
                            : `Your top ${pieData.length} account${pieData.length === 1 ? '' : 's'} by balance`}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto whitespace-nowrap">
                        Current balances
                      </span>
                    </>
                  }
                  onOpen={() => openReport('account-distribution')}
                >
                  {distribution.wedges.length === 0 ? (
                    /* THE SAME BOX THE CHART WOULD FILL, which is what makes
                       this card the same height as Expense Categories beside
                       it. Shipped first as a bare `py-8`, and the owner saw it
                       immediately: an empty card that shrinks is a card that
                       does not line up with its neighbour, and on a fresh
                       ledger every card is empty, so they ALL disagree. The
                       height is the shared `WIDGET_CHART_HEIGHT` rather than a
                       number, so the two can never drift apart again. */
                    <div className={`${WIDGET_CHART_HEIGHT} flex items-center justify-center`}>
                      <p className="text-center text-sm text-gray-400">
                        No account balances to compare yet
                      </p>
                    </div>
                  ) : (
                  <>
                  {/* A SQUARE for the ring, ALL remaining width for the names —
                      the same rule the Expense Categories card follows, so the
                      two donuts on this page sit at the same size and start at
                      the same x. The column used to be `sm:w-48 lg:w-56`, which
                      at lg was 224px around a 208px-tall ring: 16px the account
                      names could have had, spent on a margin nobody asked for.
                      Stacked below sm, where neither fits beside the other. */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={`${WIDGET_CHART_HEIGHT} sm:aspect-square sm:flex-shrink-0`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart
                          // The ring draws `wedges` and the legend `slices` —
                          // one derivation apart (see accountDistribution): a
                          // below-zero remainder stays in the legend, in its
                          // accounting parentheses, and out of the ring.
                          data={distribution.wedges}
                          innerRadius={true}
                          colors={chartRamp}
                          // Straight into that account's register. It used to
                          // go to the global list filtered to the account,
                          // which is the same answer one page further away —
                          // and that page is retired. The remainder slice has
                          // no single register to open, so it opens the full
                          // report, where every folded account is a row.
                          onClick={(clickedData: AccountDistributionEntry) => {
                            if (clickedData.id === ACCOUNT_DISTRIBUTION_REMAINDER_ID) {
                              openReport('account-distribution');
                            } else {
                              navigate(preserveDemoParam(`/accounts/${clickedData.id}`, location.search));
                            }
                          }}
                          formatter={(value: number) => formatCurrencyWithSymbol(value, displayCurrency)}
                          aria-label="Pie chart showing distribution of account balances"
                        />
                      </ResponsiveContainer>
                    </div>
                    {/* Legend: which slice is which, with values and shares */}
                    <ul className="sm:flex-1 sm:min-w-0 space-y-2" aria-label="Account distribution legend">
                      {pieData.map((d, i) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            // The remainder row has ninety registers behind it,
                            // not one — it opens the report that lists them all.
                            onClick={() => d.id === ACCOUNT_DISTRIBUTION_REMAINDER_ID
                              ? openReport('account-distribution')
                              : navigate(preserveDemoParam(`/accounts/${d.id}`, location.search))}
                            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                          >
                            <span
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: categoricalColor(chartRamp, i) }}
                              aria-hidden="true"
                            />
                            <span className="flex-1 min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{d.name}</span>
                            {/* A negative remainder wears the accounting
                                parentheses and the red every negative figure
                                wears — the legend states the netting the ring
                                cannot draw. */}
                            <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                              d.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                            }`}>
                              {formatCurrencyWithSymbol(d.value, displayCurrency)}
                            </span>
                            <span className="w-12 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">
                              {d.share
                                ? d.share.lessThan(0)
                                  ? `(${formatDecimal(d.share.abs(), 1)}%)`
                                  : `${formatDecimal(d.share, 1)}%`
                                : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  </>
                  )}
                </DashboardWidgetCard>
              )}
            </div>
          )}

          {showFlowsColumn && (
            <div className="space-y-4">
              {flowsReports.map(id => (
                id === 'income-expense-trend'
                  ? <IncomeExpenseTrendWidget key={id} picker={trendCard.picker} pin={trendCard.pin} />
                  : <ExpenseCategoriesWidget key={id} picker={categoriesCard.picker} pin={categoriesCard.pin} />
              ))}
            </div>
          )}
        </div>

        {/* Custom reports answer their own question and take no period, so
            they sit below both columns rather than inside either. */}
        {customPinnedReports.length > 0 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customPinnedReports.map(id => (
              <CustomReportWidget key={id} reportId={id.slice('custom:'.length)} />
            ))}
          </div>
        )}

        {pinnedReports.length === 0 && (
          <button
            type="button"
            onClick={() => setShowReportPicker(true)}
            className={`w-full justify-center py-8 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${pieData.length > 0 ? 'mt-2' : ''}`}
          >
            No reports pinned — click to choose the reports you want at a glance
          </button>
        )}
      </section>

      {/* Report picker */}
      <Modal
        isOpen={showReportPicker}
        onClose={() => setShowReportPicker(false)}
        title="Choose your dashboard reports"
        size="sm"
      >
        <ModalBody>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Pick the reports you want at a glance. They stay live and click through to the full report.
          </p>
          <div className="space-y-1">
            {BUILT_IN_REPORTS.map(({ id, label, icon: Icon }) => (
              <label key={id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinnedReports.includes(id)}
                  onChange={() => togglePinnedReport(id)}
                  className="rounded border-gray-300"
                />
                <Icon size={16} className="text-gray-500" />
                <span className="text-sm text-gray-800 dark:text-gray-200">{label}</span>
              </label>
            ))}
            {customReports.map(report => (
              <label key={report.id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinnedReports.includes(`custom:${report.id}`)}
                  onChange={() => togglePinnedReport(`custom:${report.id}`)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{report.name}</span>
                <span className="ml-auto text-xs text-gray-400">custom</span>
              </label>
            ))}
          </div>
        </ModalBody>
      </Modal>

      {/* Income/Expense breakdown — the shared component (category sections,
          sortable headings, click-to-edit) also used by the Reports page. */}
      <IncomeExpenseBreakdownModal
        isOpen={breakdownType !== null}
        onClose={() => setBreakdownType(null)}
        title={`${breakdownType === 'income' ? 'Income' : 'Expenses'} — ${PERIOD_LABELS[performancePeriod.period]}`}
        bucket={breakdownType ?? 'income'}
        rows={breakdownType === 'income' ? performance.incomeRows : performance.expenseRows}
        total={breakdownType === 'income' ? performance.income : performance.expenses}
        categories={categories}
        onEditTransaction={setEditingBreakdownTxnId}
      />

      {/* Edit a transaction straight from the breakdown list */}
      {editingBreakdownTxnId && (
        <EditTransactionModal
          isOpen
          onClose={() => setEditingBreakdownTxnId(null)}
          transaction={transactions.find(t => t.id === editingBreakdownTxnId) ?? null}
        />
      )}

      {/* Budget Status Section - Shows current budget progress */}
      {metrics.budgetStatus.length > 0 && (
        <section 
          aria-labelledby="budget-status-heading"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6" 
          data-testid="budget-status"
        >
          <h3 id="budget-status-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            Budget Status
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({formatDecimal(metrics.overallBudgetPercent, 0)}% used)
            </span>
          </h3>
          
          <div className="space-y-3">
            {metrics.budgetStatus.slice(0, 3).map(budget => (
              <div key={budget.id} className="space-y-2" role="group" aria-label={`Budget for ${budget.categoryName}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {budget.categoryName}
                  </span>
                  <span className={`font-medium ${
                    budget.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatCurrencyWithSymbol(budget.spent)} / {formatCurrencyWithSymbol(budget.amount)}
                  </span>
                </div>
                <div 
                  className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.min(budget.percentUsed, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${budget.categoryName} budget: ${Math.min(budget.percentUsed, 100).toFixed(0)}% used`}
                >
                  <div 
                    className={`h-full transition-all duration-300 ${
                      budget.percentUsed > 100 ? 'bg-red-500' :
                      budget.percentUsed > 80 ? 'bg-yellow-500' :
                      budget.percentUsed > 60 ? 'bg-blue-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            
            {metrics.budgetStatus.length > 3 && (
              <button 
                onClick={() => navigate(preserveDemoParam('/budget', location.search))}
                className="w-full justify-center mt-2 py-2 text-blue-700 dark:text-blue-400 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View All Budgets ({metrics.budgetStatus.length}) →
              </button>
            )}
          </div>
        </section>
      )}

      {/* Account Balances Section - Customizable by user */}
      <section 
        aria-labelledby="key-accounts-heading"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="key-accounts-heading" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Key Account Balances
            {displayedAccounts.length > 0 && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap">
                ({displayedAccounts.length} of {accounts.length})
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowAccountSettings(!showAccountSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Customise displayed accounts"
            aria-expanded={showAccountSettings}
          >
            <SettingsIcon size={20} className="text-gray-500" />
          </button>
        </div>
        
        {/* Account Selection Panel */}
        {showAccountSettings && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select accounts to display on dashboard:
              </p>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                aria-label="Close account settings"
              >
                <XIcon size={16} className="text-gray-500" />
              </button>
            </div>
            {/* Both ends of the choice in one click — sixty accounts is sixty
                clicks to start from nothing, or from everything. */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={selectAllAccounts}
                className="px-4 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAllAccounts}
                className="px-4 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-3">
              {accountSections.map(section => (
                <div key={section.label}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {section.accounts.map(account => {
                      const isSelected = selectedAccountIds.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => toggleAccountSelection(account.id)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                              : 'bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-550'
                          }`}
                          aria-pressed={isSelected ? 'true' : 'false'}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#1a2332] text-white'
                              : 'border border-gray-300 dark:border-gray-400'
                          }`}>
                            {isSelected && <CheckIcon size={12} />}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {account.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto whitespace-nowrap">
                            {formatCurrencyWithSymbol(getAccountBalance(account))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Tip: Select your most important accounts, then drag a card to
              put them in the order you want
            </div>
          </div>
        )}
        
        {/* Where a moved card landed, for anyone who cannot see it land. */}
        <div className="sr-only" aria-live="polite">{reorderAnnouncement}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayedAccounts.length > 0 ? (
            displayedAccounts.map(account => (
              <div
                key={account.id}
                className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer select-none ${
                  draggingId === account.id ? 'ring-2 ring-[#6b86b3] shadow-lg opacity-90' : ''
                }`}
                style={{ touchAction: 'pan-y' }}
                data-testid="account-balance-card"
                data-account-tile-id={account.id}
                // A drag's release fires a click; the moved flag swallows it so
                // one gesture is never both a reorder and a navigation.
                onClick={() => {
                  if (dragRef.current?.moved) return;
                  navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                }}
                onPointerDown={(e) => handleTilePointerDown(e, account.id)}
                onPointerMove={handleTilePointerMove}
                onPointerUp={endTileDrag}
                onPointerCancel={cancelTileDrag}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  handleTileKeyDown(e, account.id);
                  if (e.defaultPrevented) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                  }
                }}
                aria-label={`View ${account.name} account details. Balance: ${formatCurrencyWithSymbol(getAccountBalance(account))}. Hold Alt and press an arrow key to move this card.`}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {account.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.institution || account.subtype}
                  </p>
                </div>
                <div className="text-right">
                  {/* NEUTRAL, not green (Claude Design's second look, §3).
                      A balance is a MAGNITUDE — how much is there, not which
                      way it went — so £0.00 rendered in income green said
                      money had come in on a ledger where nothing had.

                      This is §5 of yesterday applied to the panel that was not
                      in its blast radius; their instruction to check the
                      siblings is what found it, twice now. RED SURVIVES: an
                      account in the red is a fact worth marking, and it is the
                      one direction a balance genuinely has. */}
                  <p className={`text-lg font-bold ${
                    (getAccountBalance(account)) < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {formatCurrencyWithSymbol(getAccountBalance(account))}
                  </p>
                  {account.creditLimit && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Limit: {formatCurrencyWithSymbol(account.creditLimit)}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : showAccountSkeleton ? (
            /* SHAPE, NOT SPINNER, at the real card geometry — and nothing at
               all for the first 200ms (DESIGN_PASS §4). Without this the
               dashboard asserted "No accounts added yet" at every cold boot,
               for as long as the accounts took to arrive. */
            <div className="col-span-2">
              <TableSkeleton columns={ACCOUNT_CARD_SKELETON_COLUMNS} rowHeight={ACCOUNT_CARD_HEIGHT} />
            </div>
          ) : accountsStillArriving ? null : accounts.length > 0 ? (
            /* A SELECTION IS A FILTER. The accounts exist, the user has simply
               picked none of them to show — so this names how many are being
               held back and offers the one control that shows them, rather
               than sending the user off to find a settings icon. */
            <div className="col-span-2" role="status" aria-live="polite">
              <FilteredEmptyState
                title="No accounts are selected for the dashboard"
                hiddenCount={accounts.length}
                scope="of your accounts"
                filters={['the dashboard’s account selection']}
                onClear={selectAllAccounts}
                // Not "Clear filters": the thing hiding these accounts is a
                // selection, and the remedy should name the control it is.
                clearLabel="Show all accounts"
              />
            </div>
          ) : (
            /* No accounts at all: the first run. Say what this panel will hold
               once there is one, and hand over the control that starts it. */
            <div className="col-span-2">
              <EmptyState
                title="No accounts yet"
                description="This is where each account's balance will sit, and it is what every total, chart and budget on this dashboard is worked out from — so until you add one, the dashboard has nothing to report."
                action={{
                  label: 'Add Account',
                  onClick: () => navigate(preserveDemoParam('/accounts?action=add', location.search))
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Needs Your Attention.
          Held back until the transaction load has finished: until then an
          account's balance is its opening balance, so every alert-armed
          account flashes onto this list and off it again — a warning nobody
          asked for about money that was there all along. */}
      {!isLoading && attentionItems.length > 0 && (
        <section
          aria-labelledby="attention-heading"
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6"
          // A standing list of warnings is a region, not an alert: role="alert"
          // is assertive by definition and interrupts whatever is being read,
          // every time the dashboard renders. aria-live="polite" keeps the
          // announcement — it just waits its turn.
          role="region"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircleIcon size={24} className="text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
            <h3 id="attention-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
              Needs Your Attention
            </h3>
          </div>

          <div className="space-y-3">
            {attentionItems.map(item => (
              // One real <button> per row rather than a div wearing
              // role="button": it is keyboard-reachable and Enter/Space work
              // because it IS a button, and nesting a second button inside it
              // for the action would be invalid markup for one destination.
              <button
                key={`${item.kind}:${item.account.id}`}
                type="button"
                data-testid="attention-row"
                className="w-full flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-left hover:shadow-md transition-shadow"
                onClick={() => navigate(preserveDemoParam(item.href, location.search))}
                aria-label={`${item.account.name} needs attention: ${item.reason} ${item.actionLabel}`}
              >
                <span className="flex items-start gap-3 min-w-0">
                  <WalletIcon size={20} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {item.account.name}
                    </span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400">
                      {item.reason}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0 text-sm font-medium text-blue-700 dark:text-blue-400">
                  <span className="hidden sm:inline">{item.actionLabel}</span>
                  <ChevronRightIcon size={20} className="text-gray-400" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Net Worth Chart - only show when there's historical data */}
      {netWorthData.length > 1 && (
        <section
          aria-labelledby="net-worth-chart-heading"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
        >
          <h3 id="net-worth-chart-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3Icon size={24} className="text-gray-500" aria-hidden="true" />
            Net Worth Over Time
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your wealth progression over time
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={netWorthData}
                dataKey="netWorth"
                label="Net Worth"
                formatter={(value: number) => formatCurrencyWithSymbol(value, displayCurrency)}
                tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${formatDecimal(value / 1000000, 1)}M`;
                  if (value >= 1000) return `${formatDecimal(value / 1000, 0)}K`;
                  return formatDecimal(value, 0);
                }}
                aria-label="Bar chart showing net worth over time"
              />
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* No quick-action tiles here.
          Four 140px cards used to close the page — Add Transaction, View
          Accounts, Set Budget, Reports — and every one of them was a second
          door to a room already on screen: the sidebar names all three
          destinations permanently, and adding a transaction belongs in the
          register that will hold it. A dashboard's job is to SHOW, and the
          tiles pushed the figures up a screenful to repeat the navigation.
          The phone keeps its floating "+" (components/MobileBottomNav) — there
          the sidebar is behind a tap, so quick-add is the only door. */}

      {/* The SAME modal the Accounts page drills with, fed from the SAME
          balance map the three tiles sum — so its total and the tile cannot
          disagree, which is the whole precondition for offering the click. */}
      <AccountBreakdownModal
        view={breakdownView}
        onClose={() => setBreakdownView(null)}
        rows={accounts.map(a => ({
          id: a.id,
          name: a.name,
          institution: a.institution,
          accountType: a.type,
          balance: accountBalanceMap.get(a.id) ?? 0,
          formatted: formatCurrencyWithSymbol(accountBalanceMap.get(a.id) ?? 0),
        }))}
        formatTotal={(v) => formatCurrencyWithSymbol(v)}
        onOpenAccount={(accountId) => {
          setBreakdownView(null);
          navigate(preserveDemoParam(`/accounts/${accountId}`, location.search));
        }}
      />
    </div>
  );
}
