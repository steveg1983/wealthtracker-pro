import { useState, useMemo, useEffect, useCallback, useRef, Suspense, type ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { dataPort } from '@data';
import { preserveDemoParam } from '../utils/navigation';
import AddAccountModal from '../components/AddAccountModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import AccountBreakdownModal, { type AccountBreakdownView } from '../components/AccountBreakdownModal';
import NetWorthSummary from '../components/NetWorthSummary';
import { formatDate } from '../utils/dateFormatter';
import { accountHasHistory } from '../utils/accountHistory';
import PortfolioView from '../components/PortfolioView';
// No longer importing from lucide-react - all icons are now custom
import { ArchiveIcon, SettingsIcon, WalletIcon, CheckCircleIcon, PieChartIcon, BankIcon, RefreshCwIcon, AlertTriangleIcon, ChevronRightIcon, ChevronDownIcon, XCircleIcon, SearchIcon } from '../components/icons';
// Both bank-feed surfaces on this page come through `@service`, the seam for
// what a shared page says about the account you hold WITH somebody. On a
// device the badge draws nothing and the hook answers no connections, which
// this page's own guards already handle — see src/editions/service.ts.
import { BankConnections, BankingCriticalIncidentBadge } from '@service';
import { LoadingState } from '../components/loading/LoadingState';
import { TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX } from '../constants/bankingOps';
import { preferences } from '../services/preferencesService';

// Bank connection management lives on this page (the natural home for it);
// the Data Management page keeps only its URL-driven deep links for ops alerts.
import type { Account } from '../types';
import { ALL_ACCOUNT_SECTIONS, sectionTypeForAccount } from '../utils/accountSections';
import {
  groupAccountsForDisplay,
  parseAccountGroupingPreference,
  serializeAccountGroupingPreference,
  ACCOUNT_GROUPING_STORAGE_KEY,
  LEGACY_ACCOUNT_GROUPING_STORAGE_KEY,
  DEFAULT_ACCOUNT_GROUPING,
  type AccountGroupingOptions,
  type AccountGroupKind,
  type AccountDisplayGroup,
} from '../utils/accountGrouping';

type AccountSortMode = 'default' | 'name' | 'balance-desc' | 'balance-asc';
import { IconButton } from '../components/icons/IconButton';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import {
  useConvertedNetWorth,
  type AccountBalanceEntry,
} from '../hooks/useConvertedNetWorth';
import { useReconciliation } from '../hooks/useReconciliation';
import { countAwaitingReviewByAccount } from '../utils/transactionReview';
import { useAccountBankSync } from '@service';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { calculateTotalBalance } from '../utils/calculations-decimal';
import {
  buildChildrenByParent,
  buildTopLevelIdByAccountId,
  selectTopLevelAccounts,
} from '../utils/accountNesting';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
import EmptyState from '../components/EmptyState';
import FilteredEmptyState from '../components/FilteredEmptyState';
import { TableSkeleton, type TableSkeletonColumn } from '../components/loading/TableSkeleton';
import {
  AccountRowColumns,
  AccountBalanceCell,
  AccountCountCell,
  AccountRowEmptyCell,
  AccountRowActionSlot,
  ACCOUNT_ROW_SELECTED_CLASS,
  ACCOUNT_ROW_NAME_LINK_CLASS,
} from '../components/AccountRowColumns';
import { useArrivalRowFocus } from '../hooks/useArrivalFocus';
// The same predicate the Transactions table asks, kept in one place: a click on
// a row's own button belongs to the button, on both pages.
import { clickedOwnControl } from '../hooks/useRowClickGesture';
import {
  currentPageProvenance,
  readResumeCrumbs,
  withProvenance,
  type ProvenanceState,
} from '../utils/navigationProvenance';

/**
 * What an account row is shaped like, for the placeholder that waits in its
 * place (DESIGN_PASS §4).
 *
 * Two tracks, because that is what a row is at a glance: the name taking the
 * flexible track on the left, and the figures right-aligned in the fixed ones
 * ACCOUNT_ROW_COLUMNS_CLASS lays out. The second figure hides below `sm`
 * exactly as AccountBalanceCell's `smOnly` cell does, so the placeholder is one
 * column narrower on a phone in the same place the real row is.
 */
const ACCOUNT_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { key: 'name', className: 'flex-1' },
  { key: 'balance', width: '6.5rem' },
  { key: 'secondary', width: '7.5rem', className: 'hidden sm:block' },
];

/**
 * What a row measures: `p-3 sm:p-4` around the name, the institution line and
 * the row of figures. MEASURED in the running app at 1280px rather than added
 * up from the classes — the arithmetic said 88 and the DOM says 98, and a
 * placeholder 10px short of the row it stands in for is the layout shift this
 * pattern exists to prevent.
 */
const ACCOUNT_ROW_HEIGHT = 98;

/**
 * The two "Group by" switches as stored. Read through the shared parser, which
 * migrates the pre-toggle single choice — so someone whose page was grouped by
 * institution yesterday still sees institution bands today. localStorage can
 * throw outright (Safari private browsing), which must not stop the page
 * rendering, hence the catch as well as the parser's own.
 */
function readStoredGrouping(): AccountGroupingOptions {
  try {
    return parseAccountGroupingPreference(
      preferences.getItem(ACCOUNT_GROUPING_STORAGE_KEY),
      // The pre-toggle key is read from the BROWSER: it was written before
      // preferences travelled, so this migration has to look where it was left.
      localStorage.getItem(LEGACY_ACCOUNT_GROUPING_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_ACCOUNT_GROUPING;
  }
}

/** A row's element id, so the arrow keys can hand it the focus by name. */
const rowDomId = (accountId: string): string => `account-row-${accountId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The way back FROM a register, as this page reads it.
 *
 * The mechanism is navigationProvenance's, unchanged: on the way into a
 * register this page writes its own crumbs (`{ accountId }`) into the
 * provenance it sends, and the register's back button hands exactly those
 * crumbs back — it never looks inside them, which is why each origin gets to
 * own its own shape. Parsed rather than trusted, because a history entry can
 * have been written by last week's build; anything unreadable reads as "an
 * ordinary arrival", which is the safe answer (no row is singled out).
 */
const readArrivalAccountId = (state: unknown): string | null => {
  const crumbs = readResumeCrumbs(state);
  if (!isRecord(crumbs)) return null;
  const accountId: unknown = crumbs.accountId;
  return typeof accountId === 'string' && accountId !== '' ? accountId : null;
};

/**
 * The list as it is DRAWN, once the search and the folds have had their say.
 *
 * Computed once and read twice — by the renderer, and by the arrow keys that
 * walk it — so "the rows on screen" cannot mean two different things. A model
 * built separately for the keyboard would skip a folded band on one of the two
 * and strand the highlight on a row nobody can see.
 */
interface DisplayedSubBand {
  label: string;
  title: string;
  /** The whole sub-band: its count and total describe this, not the filtered rows. */
  accounts: readonly Account[];
  /** What actually renders, sorted and filtered. */
  displayed: Account[];
}

interface DisplayedBand {
  group: AccountDisplayGroup<Account>;
  displayed: Account[];
  subBands: DisplayedSubBand[] | null;
  isExpanded: boolean;
}

/**
 * Where a band's converted total is filed.
 *
 * Module-level so the pass that BUILDS the totals and the pass that draws them
 * cannot drift into two different spellings of the same band. It happens to
 * read like `collapseKeyFor`; that is a coincidence of format, not a shared
 * meaning, and the two are deliberately not the same function.
 */
const bandTotalKey = (kind: AccountGroupKind, label: string): string => `${kind}:${label}`;
const subBandTotalKey = (kind: AccountGroupKind, label: string, subLabel: string): string =>
  `${kind}:${label}::${subLabel}`;

/** Stable identity for the single-currency case: no groups, so no conversion. */
const NO_GROUP_ENTRIES: ReadonlyMap<string, readonly AccountBalanceEntry[]> = new Map();

/**
 * A group total, ready to print, and the same thing said out loud.
 *
 * The two differ in exactly one place: `≈` is a glyph screen readers do not
 * reliably announce, so the spoken form says "approximately" and the visible
 * form keeps the mark the design pass asked for.
 */
interface BandTotalFigure {
  text: string;
  spoken: string;
}

type DisplayedList =
  | { mode: 'flat'; accounts: Account[] }
  | { mode: 'grouped'; bands: DisplayedBand[] };

export default function Accounts() {
  const { accounts, transactions, serverBalances, updateAccount, closeAccount, refreshAccountsAndTransactions, refreshCategories } = useApp();
  const { showError } = useToast();
  const { formatCurrency: formatDisplayCurrency, displayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // null = closed; 'critical'/'jwks' preset the ops filters the incident
  // badges deep-link to (mirrors the Data Management handlers).
  const [bankConnectionsView, setBankConnectionsView] = useState<null | 'plain' | 'critical' | 'jwks'>(null);
  const [portfolioAccountId, setPortfolioAccountId] = useState<string | null>(null);
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  const [breakdownView, setBreakdownView] = useState<AccountBreakdownView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Two INDEPENDENT switches, not a choice of one: Account Type and Institution
  // each on or off. Both on nests institutions inside the type sections; both
  // off is a single flat list.
  const [grouping, setGrouping] = useState<AccountGroupingOptions>(readStoredGrouping);
  const [sortMode, setSortMode] = useState<AccountSortMode>(() => {
    const stored = preferences.getItem('accountsSortMode');
    return stored === 'name' || stored === 'balance-desc' || stored === 'balance-asc'
      ? stored
      : 'default';
  });

  // Which group sections the user has folded away. With ~200 accounts the list
  // is unmanageable fully expanded, so a heading can be collapsed down to just
  // its name, count and running total (that total is the whole point of
  // collapsing — you still see what a section is worth without its rows).
  // Keyed by "<kind>:<label>" — the dimension the band groups BY, not the whole
  // view — so collapsing "Natwest" under Institution can never also collapse a
  // same-named section under Account Type, and a folded type section stays
  // folded when the Institution switch is flipped alongside it.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = preferences.getItem('accountsCollapsedGroups');
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed)
        ? new Set(parsed.filter((key): key is string => typeof key === 'string'))
        : new Set<string>();
    } catch {
      // A corrupt value must never wedge the page — start with nothing collapsed.
      return new Set<string>();
    }
  });

  // Free-text filter over account (and institution) names. Kept out of
  // localStorage: it's a transient lens, not a saved preference — clearing it
  // returns the full grouped view. No debounce: the list is in memory and this
  // is a substring test over a couple of hundred rows.
  const [accountSearch, setAccountSearch] = useState('');

  // The mobile +'s "Add Account" deep-links /accounts?action=add — open the
  // modal and consume the param (replace), so back/refresh cannot re-open it.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      setIsAddModalOpen(true);
      params.delete('action');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const { getUnreconciledCount, computeAccountBalance: computeLedgerBalance } = useReconciliation(accounts, transactions);

  /**
   * How much freshly-imported work is waiting in each account.
   *
   * The same mechanism the Unreconciled column beside it uses (useReconciliation
   * builds one per-account map from the transaction list and answers in
   * constant time): filtering the whole ledger inside each card would be
   * quadratic in the number of accounts, over a fifty-thousand row list, on a
   * page that re-renders on every sync.
   *
   * Not folded into useReconciliation, because it is not reconciliation. "Does
   * this account agree with the bank?" and "has anybody looked at what arrived?"
   * are two questions that happen to be counted the same way, and a hook that
   * answers both would be a hook named for one of them.
   */
  const toReviewByAccount = useMemo(
    () => countAwaitingReviewByAccount(transactions),
    [transactions]
  );

  // The transaction pages take seconds to arrive on a long history, and until
  // the first one lands every ledger sum is just the opening balance. The
  // server's one-round-trip figures (same invariant, summed in Postgres) stand
  // in for that window only — the ledger computation is the source of truth
  // and takes over the moment any transaction is present.
  const seededBalances = transactions.length === 0 ? serverBalances : null;
  const computeAccountBalance = useCallback(
    (accountId: string): number => seededBalances?.get(accountId)?.balance ?? computeLedgerBalance(accountId),
    [seededBalances, computeLedgerBalance]
  );
  // Per-account bank connection metadata + one-click "pull fresh bank data".
  const { getAccountLink, isAccountSyncing, syncAccount, syncAllConnections, connectedCount, isSyncingAny } = useAccountBankSync({ onSynced: refreshAccountsAndTransactions });

  // Only OPEN accounts appear in the main list and totals; closed ones live in
  // the Closed Accounts section below (the Microsoft Money model — closing
  // hides an account without touching its history, and it can be reopened).
  const openAccounts = useMemo(() => accounts.filter(a => a.isActive !== false), [accounts]);

  // Investment↔cash pairing (the Microsoft Money model): a cash account whose
  // parentAccountId points at another OPEN account renders nested inside that
  // parent's card instead of as a top-level card, and its balance counts
  // toward the parent's group total. It stays a full account — own register,
  // transfers, reconciliation — only its placement here changes. The rules
  // live in utils/accountNesting, shared with the Investments page so the two
  // can never disagree about what a paired account is worth.
  const nestedByParent = useMemo(() => buildChildrenByParent(openAccounts), [openAccounts]);

  const topLevelAccounts = useMemo(() => selectTopLevelAccounts(openAccounts), [openAccounts]);
  const [closedAccounts, setClosedAccounts] = useState<Account[]>([]);
  const [showClosedAccounts, setShowClosedAccounts] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  /**
   * Still on screen? The closed list is fetched, and the fetch outlives the
   * page whenever somebody leaves before it lands — a state write after that is
   * a write to a component that no longer exists (and, under a test runner
   * tearing the DOM down, an intermittent failure in whatever suite happens to
   * be running next). Guarded here rather than only in the mount effect,
   * because every caller below is equally able to be the last one out.
   */
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadClosedAccounts = useCallback(async () => {
    try {
      const closed = await dataPort.listClosedAccounts();
      if (isMountedRef.current) setClosedAccounts(closed);
    } catch {
      // Non-fatal: the section simply shows empty; a retry happens on next open.
      if (isMountedRef.current) setClosedAccounts([]);
    }
  }, []);

  useEffect(() => {
    void loadClosedAccounts();
  }, [loadClosedAccounts]);

  const handleReopenAccount = useCallback(async (accountId: string) => {
    if (reopeningId) return;
    setReopeningId(accountId);
    try {
      await updateAccount(accountId, { isActive: true });
      // The reopened account isn't in context state (closed ones are filtered
      // out at load), so re-pull actives and refresh the closed list. The DB
      // trigger also re-activated its transfer category — refresh categories
      // so it reappears in dropdowns without a reload.
      await refreshAccountsAndTransactions();
      await refreshCategories();
      await loadClosedAccounts();
    } catch (error) {
      showError(error);
    } finally {
      setReopeningId(null);
    }
  }, [reopeningId, updateAccount, refreshAccountsAndTransactions, refreshCategories, loadClosedAccounts, showError]);

  // Closed accounts get the SAME grouping as the open list, in all four switch
  // combinations, so the archive reads the way the live list does. Rows within
  // a group are alphabetical by name; that was the whole point of this change
  // (they used to arrive in no order at all). The grouping preserves input
  // order, so sorting once up front sorts every band. Empty bands don't render.
  // Kept independent of `sortMode`: the live list's Value/Default sorts are for
  // triage, but an archive you're scanning for one name always wants A–Z.
  const closedAccountBands = useMemo(
    () => groupAccountsForDisplay(
      [...closedAccounts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      grouping
    ),
    [closedAccounts, grouping]
  );

  // Convert accounts to decimal for calculations
  const decimalAccounts = useMemo(() => openAccounts.map(a => ({
    ...a,
    balance: toDecimal(a.balance),
    openingBalance: a.openingBalance ? toDecimal(a.openingBalance) : undefined,
    holdings: a.holdings ? a.holdings.map(h => ({
      ...h,
      shares: toDecimal(h.shares),
      value: toDecimal(h.value),
      averageCost: h.averageCost ? toDecimal(h.averageCost) : undefined,
      currentPrice: h.currentPrice ? toDecimal(h.currentPrice) : undefined,
      marketValue: h.marketValue ? toDecimal(h.marketValue) : undefined,
      gain: h.gain ? toDecimal(h.gain) : undefined,
      gainPercent: h.gainPercent ? toDecimal(h.gainPercent) : undefined,
      costBasis: h.costBasis ? toDecimal(h.costBasis) : undefined
    })) : undefined
  })), [openAccounts]);

  /**
   * Every open account's balance beside the currency it is HELD in.
   *
   * The input to the net-worth card's three figures. Until this existed the
   * card added balances across currencies one-for-one and printed the answer in
   * the display currency — a dollar counted as a pound. The app had already
   * written the rule down for budgets ("a number that is true in no currency at
   * all"); the summary above the account list was the surface still breaking it.
   */
  const netWorthEntries = useMemo(
    () => openAccounts.map(a => ({
      balance: computeAccountBalance(a.id),
      currency: a.currency || displayCurrency,
    })),
    [openAccounts, computeAccountBalance, displayCurrency]
  );

  /**
   * Whether any account is held in something other than the display currency.
   *
   * The switch that keeps this change free for the people it does not concern.
   * False — the overwhelmingly common case — and the three figures below are
   * computed exactly as they have always been, by exactly the same functions,
   * to exactly the same number. No conversion, no request, no disclosure.
   */
  const spansCurrencies = useMemo(
    () => netWorthEntries.some(entry => entry.currency !== displayCurrency),
    [netWorthEntries, displayCurrency]
  );

  // The conversion itself is set up below, once the band decomposition it also
  // feeds (`groupCurrencyEntries`) exists — one pass converts the card and every
  // group header together. See `totalForBand`.

  // The open list's bands, straight from the two switches — type sections,
  // institution bands, type sections with institution sub-bands, or one flat
  // list. Nested cash accounts ride inside their parent's card, so only
  // top-level accounts band here. Bucketing by SECTION type (not the raw type
  // string) is what stops an "Other Assets" or 'mortgage' account vanishing
  // under a key no section ever looked up — see `sectionTypeForAccount`.
  const accountBands = useMemo(
    () => groupAccountsForDisplay(topLevelAccounts, grouping),
    [topLevelAccounts, grouping]
  );

  // Set loading to false when accounts are loaded
  useEffect(() => {
    if (accounts !== undefined) {
      setIsLoading(false);
    }
  }, [accounts]);
  
  // Convert transactions to decimal for balance calculations
  const decimalTransactions = useMemo(() => transactions.map(t => ({
    ...t,
    amount: toDecimal(t.amount),
  })), [transactions]);

  // Which top-level card an account's money counts toward: itself, or the
  // nearest ancestor that IS a top-level card. A nested cash account belongs to
  // the band its PARENT sits in (Investments), not the one its own type or
  // institution would suggest.
  const topLevelIdByAccountId = useMemo(
    () => buildTopLevelIdByAccountId(openAccounts),
    [openAccounts]
  );

  // A band's running total: every open account whose money counts toward one of
  // the band's cards, summed as Decimal (opening balance + its transactions) —
  // the same figure the net-worth bar shows, never floating-point arithmetic.
  const totalForBand = useCallback((bandAccounts: readonly Account[]): DecimalInstance => {
    const ids = new Set(bandAccounts.map(a => a.id));
    return calculateTotalBalance(
      decimalAccounts.filter(a => ids.has(topLevelIdByAccountId.get(a.id) ?? a.id)),
      decimalTransactions
    );
  }, [decimalAccounts, decimalTransactions, topLevelIdByAccountId]);

  /**
   * The same band total as above, split into one line per currency HELD.
   *
   * Deliberately the same decomposition: identical account expansion, identical
   * `calculateTotalBalance`, merely partitioned by currency first. Because that
   * partition is a plain sum, these lines add back up to exactly the figure
   * `totalForBand` returns — so a converted band total is the band total this
   * page has always shown, converted, and never a second opinion about what the
   * band is worth.
   *
   * A nested account contributes its OWN currency, not its parent's: a dollar
   * cash sleeve inside a sterling investment account is still dollars.
   */
  const currencySubtotalsForBand = useCallback(
    (bandAccounts: readonly Account[]): AccountBalanceEntry[] => {
      const ids = new Set(bandAccounts.map(a => a.id));
      const inBand = decimalAccounts.filter(a => ids.has(topLevelIdByAccountId.get(a.id) ?? a.id));
      const buckets = new Map<string, typeof inBand>();
      for (const account of inBand) {
        const currency = account.currency || displayCurrency;
        const bucket = buckets.get(currency);
        if (bucket) bucket.push(account);
        else buckets.set(currency, [account]);
      }
      return [...buckets].map(([currency, bucket]) => ({
        balance: calculateTotalBalance(bucket, decimalTransactions),
        currency,
      }));
    },
    [decimalAccounts, decimalTransactions, topLevelIdByAccountId, displayCurrency]
  );

  /**
   * Every band and sub-band on the page, decomposed for the one conversion pass.
   *
   * Empty — and therefore free — whenever the ledger reads in one currency,
   * which is the common case: no decomposition, no map, no conversion, and the
   * headers below fall through to the untouched `totalForBand` path.
   */
  const groupCurrencyEntries = useMemo<ReadonlyMap<string, readonly AccountBalanceEntry[]>>(() => {
    if (!spansCurrencies || accountBands.mode !== 'grouped') return NO_GROUP_ENTRIES;
    const entries = new Map<string, readonly AccountBalanceEntry[]>();
    for (const group of accountBands.groups) {
      entries.set(bandTotalKey(group.kind, group.label), currencySubtotalsForBand(group.accounts));
      for (const sub of group.subGroups ?? []) {
        entries.set(
          subBandTotalKey(group.kind, group.label, sub.label),
          currencySubtotalsForBand(sub.accounts)
        );
      }
    }
    return entries;
  }, [spansCurrencies, accountBands, currencySubtotalsForBand]);

  /**
   * ONE conversion for the whole page: the net-worth card's three figures and
   * every group header's total, off one rate table, resolved in one state
   * update.
   *
   * That single call is what makes the ruling's coherence requirement
   * structural rather than aspirational. A group total cannot look confident
   * while the card above it reads degraded, because neither figure has a
   * provenance of its own to disagree with — there is one, and the `≈` on a
   * group total is a pointer to it (`ConvertedTotalNote`, under the card).
   */
  const convertedNetWorth = useConvertedNetWorth(
    netWorthEntries,
    displayCurrency,
    groupCurrencyEntries
  );

  // The shared account-type sections (same groupings everywhere), catch-all
  // last — a type without a section renders under "Other Accounts", never
  // nowhere.
  const accountTypes = ALL_ACCOUNT_SECTIONS;

  // Each switch flips on its own: both on nests, both off flattens.
  const handleGroupingChange = (next: AccountGroupingOptions) => {
    setGrouping(next);
    try {
      preferences.setItem(ACCOUNT_GROUPING_STORAGE_KEY, serializeAccountGroupingPreference(next));
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  };

  const handleSortChange = (value: AccountSortMode) => {
    setSortMode(value);
    preferences.setItem('accountsSortMode', value);
  };

  // Fold a group open/closed and persist the whole collapsed set, so the choice
  // survives a reload. Takes the fully-qualified "<kind>:<label>" key.
  const toggleGroupCollapsed = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      preferences.setItem('accountsCollapsedGroups', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Order accounts WITHIN each group. 'default' keeps insertion order (as
  // loaded); balance sorts use Decimal comparison on the computed ledger
  // balance — ordering only, never arithmetic.
  const sortAccounts = useCallback((list: Account[]): Account[] => {
    if (sortMode === 'default') {
      return list;
    }
    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else {
      sorted.sort((a, b) => {
        const comparison = toDecimal(computeAccountBalance(a.id))
          .comparedTo(toDecimal(computeAccountBalance(b.id)));
        return sortMode === 'balance-desc' ? -comparison : comparison;
      });
    }
    return sorted;
  }, [sortMode, computeAccountBalance]);

  // Get icon for account type
  const getAccountTypeIcon = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === sectionTypeForAccount(type));
    return typeConfig?.icon || WalletIcon;
  };

  const getAccountTypeColor = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === sectionTypeForAccount(type));
    return typeConfig?.color || 'text-gray-600';
  };

  const handleClose = (accountId: string) => {
    if (window.confirm('Close this account? It moves to the Closed Accounts section — every transaction is preserved and you can reopen it at any time. Its transfer category is hidden from transaction dropdowns while closed.')) {
      void (async () => {
        try {
          await closeAccount(accountId);
          // The DB trigger deactivated the account's transfer category —
          // refresh categories so it leaves dropdowns without a reload.
          await refreshCategories();
          await loadClosedAccounts();
        } catch (error) {
          showError(error);
        }
      })();
    }
  };

  // ── Which rows are on screen ───────────────────────────────────────────────

  // Search matching. An empty query matches nothing here on purpose — the
  // caller only filters while `isSearching`, so the full grouped view is what
  // shows when the box is clear.
  const normalizedSearch = accountSearch.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  const accountMatchesSearch = useCallback(
    (account: Account): boolean =>
      account.name.toLowerCase().includes(normalizedSearch) ||
      (account.institution?.toLowerCase().includes(normalizedSearch) ?? false),
    [normalizedSearch]
  );
  // A nested cash account rides inside its parent's card, never as a card of its
  // own, so a hit on the child keeps the parent in the results (the child still
  // shows nested inside it) rather than vanishing with nowhere to appear.
  const accountOrChildMatches = useCallback(
    (account: Account): boolean =>
      accountMatchesSearch(account) ||
      (nestedByParent.get(account.id) ?? []).some(accountMatchesSearch),
    [accountMatchesSearch, nestedByParent]
  );
  const matchedTopLevelCount = isSearching
    ? topLevelAccounts.filter(accountOrChildMatches).length
    : topLevelAccounts.length;

  // The collapsed-set key and the region id both key off the band's dimension
  // and label — see `collapsedGroups` for why the dimension is part of the key.
  const collapseKeyFor = (kind: AccountGroupKind, label: string) => `${kind}:${label}`;
  const groupRegionId = (kind: AccountGroupKind, label: string) =>
    `account-group-${kind}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  /**
   * The whole list, decided once: which bands survive the search, which are
   * folded away, and the accounts inside each — sorted as the Sort switch says.
   *
   * The renderer walks this, and so does the keyboard. That is the point: the
   * arrows must move through exactly the rows a person can see, and a second
   * model built for them would eventually disagree with the first about a
   * folded band or a filtered row.
   */
  const displayedList = useMemo<DisplayedList>(() => {
    if (accountBands.mode === 'flat') {
      return {
        mode: 'flat',
        accounts: sortAccounts(
          isSearching ? accountBands.accounts.filter(accountOrChildMatches) : accountBands.accounts
        ),
      };
    }
    const bands: DisplayedBand[] = [];
    for (const group of accountBands.groups) {
      const displayed = isSearching ? group.accounts.filter(accountOrChildMatches) : group.accounts;
      // A search that hides its own hits would be worse than no search, so a
      // band with no match drops out entirely instead of showing an empty card.
      if (isSearching && displayed.length === 0) continue;
      // Sub-bands are filtered the same way, and an all-miss sub-band drops out
      // while its siblings keep their headings.
      const subBands = group.subGroups
        ?.map(sub => ({
          label: sub.label,
          title: sub.title,
          accounts: sub.accounts,
          displayed: sortAccounts(isSearching ? sub.accounts.filter(accountOrChildMatches) : sub.accounts),
        }))
        .filter(sub => sub.displayed.length > 0) ?? null;
      bands.push({
        group,
        displayed: sortAccounts(displayed),
        subBands,
        // While searching, collapse is deliberately ignored: a folded section
        // must not swallow a result the user is actively looking for.
        isExpanded: isSearching || !collapsedGroups.has(collapseKeyFor(group.kind, group.label)),
      });
    }
    return { mode: 'grouped', bands };
  }, [accountBands, isSearching, accountOrChildMatches, sortAccounts, collapsedGroups]);

  /**
   * Every row on screen, top to bottom.
   *
   * A nested cash account follows its parent, because that is where it is
   * drawn: it is a row like any other — its own register, its own figures — and
   * arrowing down a card only to jump over the cash sitting inside it would be
   * the list disagreeing with itself.
   */
  const navigableRowIds = useMemo<string[]>(() => {
    const withNested = (list: readonly Account[]): string[] =>
      list.flatMap(account => [
        account.id,
        ...(nestedByParent.get(account.id) ?? []).map(child => child.id),
      ]);
    if (displayedList.mode === 'flat') return withNested(displayedList.accounts);
    const ids: string[] = [];
    for (const band of displayedList.bands) {
      if (!band.isExpanded) continue;
      if (band.subBands) {
        for (const sub of band.subBands) ids.push(...withNested(sub.displayed));
      } else {
        ids.push(...withNested(band.displayed));
      }
    }
    return ids;
  }, [displayedList, nestedByParent]);

  // ── The register's selection idiom, brought to the list ────────────────────

  /**
   * The row the user has picked out, if any.
   *
   * The same three gestures the register answers to: click a row's plain
   * background to select it (the NAME is a link, and opens the account —
   * selecting is what the rest of the row means), walk the selection with the
   * arrows, Enter to open, Escape to let go. Nothing here writes anything: a
   * selection is a place to be, not a change to the ledger.
   */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  /**
   * Where the user is coming back FROM, when it is a register they opened here.
   *
   * The crumb is read straight off the live location rather than kept in state:
   * it belongs to the history entry, so the browser's own Back button restores
   * it too, and a re-render cannot lose it.
   */
  const arrivalAccountId = readArrivalAccountId(location.state);
  const { isFocused: isArrivalRow, focusRef: scrollArrivalRowIntoView } =
    useArrivalRowFocus(arrivalAccountId);

  // Arriving from a register selects the row you left, so the way back lands
  // you exactly where you were — highlighted, floating, and with the arrows
  // live from that row.
  useEffect(() => {
    if (arrivalAccountId !== null) setSelectedAccountId(arrivalAccountId);
  }, [arrivalAccountId]);

  /**
   * The arrival row itself: focused, then scrolled into the middle of the view.
   *
   * Focus first and WITHOUT its own scrolling, so the hook's centring is the
   * one that decides where the row lands. Focus rather than highlight alone
   * because the point of coming back is to carry on from there — the arrows
   * have to be live without hunting for the list with the Tab key.
   */
  const arrivalRowRef = useCallback((node: HTMLDivElement | null): void => {
    node?.focus({ preventScroll: true });
    scrollArrivalRowIntoView(node);
  }, [scrollArrivalRowIntoView]);

  /** The path into an account's register, demo session and all. */
  const registerPath = useCallback(
    (accountId: string): string => preserveDemoParam(`/accounts/${accountId}`, location.search),
    [location.search]
  );

  /**
   * What this page hands the register on the way in.
   *
   * `path` and `label` are what the register's back button becomes — the same
   * words it has always shown, because this IS the accounts list. `resume` is
   * this page's own note to itself, handed back untouched when the user
   * returns (see readArrivalAccountId).
   */
  const registerLinkState = useCallback(
    (accountId: string): ProvenanceState =>
      withProvenance(currentPageProvenance(location, 'Back to Accounts', { accountId })),
    [location]
  );

  const openAccount = useCallback((accountId: string): void => {
    navigate(registerPath(accountId), { state: registerLinkState(accountId) });
  }, [navigate, registerPath, registerLinkState]);

  /**
   * Pick a row out, and give it the keyboard.
   *
   * The focus is what makes the arrows live on the row just clicked, without a
   * second click to "focus the list" — the same courtesy the register does for
   * its grid. preventScroll because the click proves the row is already on
   * screen.
   */
  const selectRow = useCallback((accountId: string, node: HTMLElement | null): void => {
    setSelectedAccountId(accountId);
    node?.focus({ preventScroll: true });
  }, []);

  /**
   * Walk the selection by `delta` rows, across sections and into the cash rows
   * nested in a card.
   *
   * With nothing selected yet the key selects the row it was pressed on — the
   * list is being entered, and jumping to a neighbour of nowhere would be a
   * surprise. The ends stop rather than wrap, which is what every list the user
   * already knows does.
   */
  const moveSelection = useCallback((fromRowId: string, delta: number): void => {
    if (navigableRowIds.length === 0) return;
    // -1 covers both "nothing selected" and "the selected row is filtered away"
    // — in either case this key is an arrival on the row it was pressed on.
    const currentIndex = selectedAccountId === null ? -1 : navigableRowIds.indexOf(selectedAccountId);
    const nextId = currentIndex === -1
      ? fromRowId
      : navigableRowIds[Math.min(navigableRowIds.length - 1, Math.max(0, currentIndex + delta))];
    if (nextId === undefined) return;
    setSelectedAccountId(nextId);
    const node = document.getElementById(rowDomId(nextId));
    // The row is already rendered — only its tabindex changes — so it can be
    // handed the focus directly. `nearest`: browsing, so the least scroll that
    // shows the row, and none at all while it is already visible.
    node?.focus({ preventScroll: true });
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [navigableRowIds, selectedAccountId]);

  /**
   * The keys, on the row that has the focus.
   *
   * On the ROW rather than on the page, which is what keeps them out of the way
   * of everything else here: a search box, a sort button or a group heading has
   * the focus while it is being used, so the arrows never reach this at all.
   * There is no window-level listener to fight with.
   */
  const handleRowKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLDivElement>,
    accountId: string
  ): void => {
    // A key pressed inside one of the row's own controls belongs to that
    // control: Enter on the Reconcile button must reconcile, not re-open the
    // account underneath it.
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // Claimed outright: the page must not also scroll, and the app-wide
        // shortcut listener must not see a key the list has answered.
        event.preventDefault();
        event.stopPropagation();
        moveSelection(accountId, event.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        openAccount(accountId);
        break;
      case 'Escape':
        // Claimed ONLY when there is something to let go of. Escape belongs to
        // whatever layer is outermost, and a list holding nothing is not a
        // layer — the register keeps the same rule.
        if (selectedAccountId === null) return;
        event.preventDefault();
        event.stopPropagation();
        // Let go of the row, and leave the focus where it is: the user is still
        // standing here, they have simply stopped pointing at anything.
        setSelectedAccountId(null);
        break;
      default:
        break;
    }
  }, [moveSelection, openAccount, selectedAccountId]);

  /**
   * The row Tab lands on: the selected one, or the first if the selection is
   * nowhere to be seen.
   *
   * That second case is real — search for something the selected row does not
   * match and it stops being drawn. Without the fallback the list would have no
   * tab stop at all, and the whole thing would be unreachable from the keyboard
   * until the box was cleared.
   */
  const tabStopRowId = selectedAccountId !== null && navigableRowIds.includes(selectedAccountId)
    ? selectedAccountId
    : navigableRowIds[0];

  /**
   * Everything that makes a div one of this list's rows.
   *
   * Shared by both kinds of row — the account card and the cash row nested in
   * it — because they are the same thing to a keyboard: a place the selection
   * can be.
   *
   * ─ ONE TAB STOP FOR THE WHOLE LIST ─────────────────────────────────────────
   * Roving tabindex: one row (see tabStopRowId) is the tab stop, and every
   * other row is reached from it with the arrows. With two hundred accounts a
   * page that made each row its own tab stop would take two hundred presses to
   * get past.
   *
   * ─ WHY aria-current AND NOT aria-selected ──────────────────────────────────
   * aria-selected belongs to an option, a row or a tab — it says nothing on a
   * plain card, and giving the list grid semantics to earn it would have to
   * demote the account names from headings, which is how a screen-reader user
   * navigates this page. aria-current is the marker the app's other "this is
   * the one you came for" surfaces already use (see useArrivalFocus), and the
   * row itself takes the focus as the selection moves, so the reader announces
   * the row rather than relying on the marker alone.
   */
  const rowProps = (accountId: string) => {
    const isSelected = selectedAccountId === accountId;
    return {
      id: rowDomId(accountId),
      tabIndex: accountId === tabStopRowId ? 0 : -1,
      'aria-current': isSelected ? ('true' as const) : undefined,
      onClick: (event: React.MouseEvent<HTMLDivElement>): void => {
        // A nested cash row sits INSIDE its parent's card: whatever this click
        // means, it means it for one row only.
        event.stopPropagation();
        // A click on the name, or on any of the row's buttons, is that
        // control's — the row keeps out of it.
        //
        // No useRowClickGesture here, and the reason is worth stating: that
        // hook exists for a gesture that BEGINS in an editing control and ends
        // on the row, which the browser then reports as a click on the row. A
        // row on this page has no editing controls at all — a link and some
        // buttons, whose clicks are caught by the test above — and its text is
        // drawn `select-none` (the same answer VirtualizedTable gives its
        // clickable rows), so there is no drag for it to be the tail of.
        if (clickedOwnControl(event.target, event.currentTarget)) return;
        selectRow(accountId, event.currentTarget);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>): void => handleRowKeyDown(event, accountId),
    };
  };

  /**
   * The look of a row that is selected, or the one it has when it is not.
   *
   * ─ NEITHER SKIN DECLARES A FOCUS RING ──────────────────────────────────────
   * Both used to carry `focus:outline-none focus-visible:ring-2
   * focus-visible:ring-blue-500`, and that was a duplicate: every focusable
   * element in the app already gets `outline: 2px solid var(--focus-ring-color)`
   * from accessibility-colors.css, with `!important`, so the `outline-none`
   * never took and the row drew ITS ring INSIDE that outline. Arrowing down a
   * selected row therefore showed three strokes' worth of intent in two
   * colours — the owner reported it as "a blue and a black double border" —
   * while clicking the same row looked clean, because a click does not match
   * :focus-visible. One focus indicator, app-wide, is the rule; a row does not
   * get a private one.
   */
  const rowSkin = (accountId: string, unselected: string): string =>
    selectedAccountId === accountId ? ACCOUNT_ROW_SELECTED_CLASS : unselected;

  /**
   * A row's routine actions — VISIBLE AT REST, on every row.
   *
   * ─ WHY THIS DEPARTS FROM THE DESIGN PASS, DELIBERATELY ─────────────────────
   * DESIGN_PASS_2026-08 §3.3 asked for two things about these buttons, and they
   * are separable. The objection was "twelve outlined boxes on a four-account
   * screen, and the destructive one is as loud as the routine ones" — a wall of
   * chrome in front of the figures the page exists to show. The remedy had two
   * halves: take the BOXES off, and reveal what is left on hover.
   *
   * The boxes are gone and stay gone: borderless glyphs in a neutral grey, the
   * delete no louder than the rest until it is hovered. That is where nearly
   * all of the noise was, and it is the half the owner liked on sight.
   *
   * The hover reveal is the half that came back off (owner's call, 2026-08-13,
   * after living with it). A control nobody can see is a control most people
   * never learn they have: hovering to discover what a row can do is a cost
   * paid on every row by everyone who does not already know, and the
   * touch-screen case had to be special-cased out of it precisely because the
   * interaction does not exist there. Quiet and always present beats loud, but
   * it also beats invisible — and P1's complaint was that the chrome was
   * SHOUTING, not that it existed. Told to the design author as a notice, in
   * the same spirit as the period-pin amendment.
   *
   * If this ever goes back the other way, the thing to keep is what the old
   * implementation got right: never `display: none`. A hidden button is not
   * reachable by Tab, so these were kept in the DOM and in the tab order at
   * zero opacity, and the touch case was gated on `hover: hover` because a
   * phone can never satisfy the reveal.
   */
  const ROW_ACTION_REVEAL_CLASS = 'transition-opacity duration-state';

  /**
   * "Agree this account with the bank" — the same control for every row.
   *
   * One function rather than one per row type, because a nested cash account
   * reconciles exactly as its parent does: same screen, same `from=accounts` so
   * the way back is right, and scoped to ITS id. It used to have no reconcile
   * button at all, which meant the only paired accounts in the book — the
   * Money-imported investment sleeves, the ones whose cash actually moves —
   * were the ones you could not reconcile from the list.
   *
   * Named for the account it belongs to: a card now shows two of these, and
   * "Reconcile" twice over is a control nobody can tell apart by ear.
   */
  const renderReconcileButton = (account: Account): ReactNode => (
    <button
      type="button"
      onClick={() => navigate(preserveDemoParam(`/reconciliation?account=${account.id}&from=accounts`, location.search))}
      className={`p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-gray-500 hover:text-blue-700 dark:text-gray-400 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg relative group ${ROW_ACTION_REVEAL_CLASS}`}
      title={`Reconcile ${account.name}`}
      aria-label={`Reconcile ${account.name}`}
    >
      <CheckCircleIcon size={20} />
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
        Reconcile
      </span>
    </button>
  );

  // ONE card for every grouping view — identical layout, stats and actions
  // (settings / sync / reconcile / close) regardless of how the list is
  // grouped (Steve: 'similar looking format across all our views').
  const renderAccountCard = (account: Account) => {
    const bankLink = getAccountLink(account.id);
    const syncing = isAccountSyncing(account.id);
    const TypeIcon = getAccountTypeIcon(account.type);
    const typeColor = getAccountTypeColor(account.type);
    // '' when the date is absent or unparseable — formatDate answers that way
    // rather than throwing or handing back "Invalid Date".
    const lastUpdated = formatDate(account.lastUpdated);
                  return (
                  <div
                    key={account.id}
                    ref={isArrivalRow(account.id) ? arrivalRowRef : undefined}
                    {...rowProps(account.id)}
                    // `group/row` is what reveals the row's action buttons on
                    // hover and on focus — named, because each button already
                    // owns an unnamed `group` for its tooltip.
                    //
                    // A ROW, NOT A CARD, when it is not selected: no shadow and
                    // no visible border, so the ONLY lifted thing on the page is
                    // the selected row, which is what makes that lift read
                    // (§3.3). The rounding stays and is simply invisible while
                    // the row is white on white — it is there for the selected
                    // state, whose wash and ring do show it.
                    //
                    // THE BASE OWNS THE BORDER'S WIDTH, EACH STATE ITS COLOUR.
                    // 1px on all four sides at all times is geometry: take it
                    // away for one state and the card moves 1px as it is picked
                    // out. The COLOUR is a different question with a different
                    // answer per state, so the divider hairline travels with the
                    // unselected skin below and the selected skin names its own
                    // (transparent — the ring is its only stroke). It used to
                    // live here, on both states at once, which meant a selected
                    // row drew the divider AND Tailwind's default #e5e7eb on the
                    // other three sides underneath the ring: the two-tone border
                    // this comment exists to keep from coming back.
                    className={`group/row p-3 sm:p-4 rounded-2xl border transition-all duration-300 cursor-pointer select-none ${rowSkin(
                      account.id,
                      // `dark:last:` as well as `last:`, and it is not
                      // belt-and-braces. Both `dark:border-b-gray-700` and
                      // `last:border-b-transparent` set border-bottom-color at
                      // equal specificity, so the winner is decided by the order
                      // Tailwind happens to emit them in — and `dark:` is
                      // emitted last, so in DARK MODE the band's final row drew
                      // a divider under it while light mode correctly drew
                      // none. Stacking the two variants raises the suppression
                      // above the plain `dark:` rule instead of hoping the
                      // generator keeps its current order.
                      'bg-white dark:bg-gray-800 border-transparent border-b-line dark:border-b-gray-700 last:border-b-transparent dark:last:border-b-transparent hover:bg-surface-secondary dark:hover:bg-gray-700/40'
                    )}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <TypeIcon className={typeColor} size={16} />
                          {/* The name is the way IN — a real link, so it can be
                              opened in a new tab, followed from the keyboard,
                              or copied as an address. The rest of the row means
                              "pick this one out", which is why the two are not
                              the same gesture any more.

                              The heading still takes the whole track (the
                              phone-width balance to its right is pushed there by
                              this flex-1, and the link's max-width is measured
                              against it) — but the LINK inside it hugs its own
                              letters, so the empty part of the track belongs to
                              the row. See ACCOUNT_ROW_NAME_LINK_CLASS.

                              The heading no longer clips: with the link capped
                              at the heading's width there is nothing left to
                              overflow, and `truncate` here used to hide the
                              link's own focus ring — an ancestor's overflow
                              clips a descendant's outline, so the account name
                              showed no keyboard focus at all. */}
                          <h3 className="text-base md:text-lg font-medium min-w-0 flex-1">
                            <Link
                              to={registerPath(account.id)}
                              state={registerLinkState(account.id)}
                              className={`${ACCOUNT_ROW_NAME_LINK_CLASS} text-gray-900 dark:text-white`}
                              title={`Open ${account.name}`}
                            >
                              {account.name}
                            </Link>
                          </h3>
                          {/* The figure the card exists to show, where a
                              banking list puts it: right of the name. The
                              stats row's copy hides below sm to avoid saying
                              it twice. */}
                          <span className="sm:hidden shrink-0 text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                            {formatDisplayCurrency(computeAccountBalance(account.id), account.currency)}
                          </span>
                        </div>
                        {account.institution && (
                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            {account.institution}
                          </p>
                        )}
                        {/* This line read "Last updated: Invalid Date" for any
                            account whose date was absent — a raw
                            `new Date(x).toLocaleDateString()` printing the
                            parser's failure straight onto a page about money
                            (§3.3). Two things were wrong with it, and both are
                            fixed here: it never went through formatDate(), the
                            app's own formatter, which is null-safe AND pins the
                            UK dd/mm/yyyy this app formats every other date in
                            (a bare toLocaleDateString takes the BROWSER's
                            locale); and an absent date has a plain-English
                            answer, so it gets one instead of a parser artefact.

                            `Account.lastUpdated` is typed as a required Date but
                            is not one at runtime on every path — see the note in
                            utils/demoData, where the field was simply missing. */}
                        <p className="text-xs text-gray-500 dark:text-gray-300">
                          {lastUpdated ? `Last updated: ${lastUpdated}` : 'Not yet synced'}
                        </p>
                        {bankLink && (
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            Last bank sync:{' '}
                            {bankLink.lastSync
                              ? new Date(bankLink.lastSync).toLocaleString()
                              : 'Never'}
                            {bankLink.status === 'reauth_required' && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">
                                · reconnect needed
                              </span>
                            )}
                          </p>
                        )}

                        {account.type === 'investment' && account.holdings && account.holdings.length > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 space-y-1">
                            <p>
                              Cash Balance: {formatDisplayCurrency(
                                account.balance - account.holdings.reduce((sum, h) => sum + (h.marketValue || h.value || 0), 0), 
                                account.currency
                              )}
                            </p>
                            <p>
                              Holdings Value: {formatDisplayCurrency(
                                account.holdings.reduce((sum, h) => sum + (h.marketValue || h.value || 0), 0), 
                                account.currency
                              )} ({account.holdings.length} positions)
                            </p>
                            <p className="font-medium">
                              Total Value: {formatDisplayCurrency(account.balance, account.currency)}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* The columns. Their definition — and the reason the
                          nested cash row below reads down the same lines — is
                          in components/AccountRowColumns. */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                            <AccountRowColumns>
                              <AccountBalanceCell
                                label="Bank Bal"
                                value={account.bankBalance != null
                                  ? formatDisplayCurrency(account.bankBalance, account.currency)
                                  : 'N/A'}
                              />
                              <AccountBalanceCell
                                label="Account Bal"
                                value={formatDisplayCurrency(computeAccountBalance(account.id), account.currency)}
                                smOnly
                              />
                              <AccountCountCell label="Unreconciled" count={getUnreconciledCount(account.id)} />
                              {/* To Review — freshly imported rows nobody has
                                  dealt with, so the size of the job is visible
                                  from the list rather than only from inside the
                                  register. It sits after Unreconciled because
                                  the two are the same shape of question — how
                                  much is outstanding — and reading them as a
                                  pair is the point. */}
                              <AccountCountCell label="To Review" count={toReviewByAccount.get(account.id) ?? 0} />
                              <AccountRowActionSlot>
                                {account.type === 'investment' && account.holdings && account.holdings.length > 0 && (
                                <button
                                  onClick={() => setPortfolioAccountId(account.id)}
                                  className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 rounded-lg relative group ${ROW_ACTION_REVEAL_CLASS}`}
                                  title="View Portfolio"
                                >
                                  <PieChartIcon size={16} />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    View Portfolio
                                  </span>
                                </button>
                                )}
                              </AccountRowActionSlot>
                              {/* Feed slot — rendered for every account so
                                  the three buttons to its right never move. */}
                              <AccountRowActionSlot>
                                {bankLink && (bankLink.status === 'reauth_required' ? (
                                  <div className="relative group">
                                    <IconButton
                                      onClick={() => navigate(preserveDemoParam('/open-banking', location.search))}
                                      icon={<AlertTriangleIcon size={20} />}
                                      variant="ghost"
                                      size="md"
                                      className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 min-w-[48px] min-h-[48px]"
                                      title="Reconnect bank"
                                    />
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                      Reconnect bank
                                    </span>
                                  </div>
                                ) : (
                                  // Routine, so it fades with the rest. A sync
                                  // in flight is not routine — it is something
                                  // happening to this account right now, so a
                                  // spinning icon stays visible.
                                  <div className={`relative group ${syncing ? '' : ROW_ACTION_REVEAL_CLASS}`}>
                                    <IconButton
                                      onClick={() => void syncAccount(account.id)}
                                      icon={<RefreshCwIcon size={20} className={syncing ? 'animate-spin' : ''} />}
                                      variant="ghost"
                                      size="md"
                                      disabled={syncing}
                                      className="text-gray-500 hover:text-blue-700 dark:text-gray-400 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 min-w-[48px] min-h-[48px]"
                                      title="Sync bank data"
                                    />
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                      {syncing ? 'Syncing…' : 'Sync bank data'}
                                    </span>
                                  </div>
                                ))}
                              </AccountRowActionSlot>
                              <AccountRowActionSlot>
                                <div className={`relative group ${ROW_ACTION_REVEAL_CLASS}`}>
                                  <IconButton
                                    onClick={() => setSettingsAccountId(account.id)}
                                    icon={<SettingsIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[48px] min-h-[48px]"
                                    title={`Account settings for ${account.name}`}
                                  />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Settings
                                  </span>
                                </div>
                              </AccountRowActionSlot>
                              <AccountRowActionSlot>{renderReconcileButton(account)}</AccountRowActionSlot>
                              <AccountRowActionSlot>
                                {/* Neutral until it is hovered. It is the
                                    destructive one, and drawing it permanently
                                    red made it the loudest thing on a row of
                                    routine controls — the colour belongs to
                                    the moment the pointer is actually on it. */}
                                <div className={`relative group ${ROW_ACTION_REVEAL_CLASS}`}>
                                  <IconButton
                                    onClick={() => handleClose(account.id)}
                                    icon={<ArchiveIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-gray-500 hover:text-expense dark:text-gray-400 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/30 min-w-[48px] min-h-[48px]"
                                    title={`Close ${account.name}`}
                                  />
                                  <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Close
                                  </span>
                                </div>
                              </AccountRowActionSlot>
                            </AccountRowColumns>
                      </div>
                    </div>

                    {/* Nested cash accounts (investment↔cash pairing): the
                        Money model shows the pair as one account, cash inside.

                        A ROW LIKE ANY OTHER, from here down. It is inset on the
                        LEFT — the dashes, the indent, the wallet mark and the
                        word Cash are what say it belongs to the card above it —
                        and from the figures rightwards it is its parent's twin:
                        the same columns, in the same places, so Account Bal sits
                        under Account Bal and its Reconcile button under its
                        parent's. It has always been a full account (its own
                        register, its own transfers, its own reconciliation);
                        this is the list finally saying so.

                        `sm:pr-0` is what puts its right-hand edge where the
                        card's is: the pill sits INSIDE the card's padding, so
                        any padding of its own would hold the columns short of
                        the parent's by that much. What is left is the pill's
                        own 1px border — a hairline, and its own outline, which
                        is a better thing to leave alone than to cancel with a
                        negative margin somebody would later have to explain. */}
                    {(nestedByParent.get(account.id) ?? []).map(child => {
                      const childName = child.name === `${account.name} (Cash)` ? 'Cash' : child.name;
                      return (
                        <div
                          key={child.id}
                          ref={isArrivalRow(child.id) ? arrivalRowRef : undefined}
                          {...rowProps(child.id)}
                          className={`group/row mt-3 ml-6 sm:ml-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-xl border border-dashed pl-3 pr-3 sm:pr-0 py-2.5 cursor-pointer select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${rowSkin(
                            child.id,
                            'border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700/60 hover:border-gray-400 dark:hover:border-gray-400'
                          )}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <WalletIcon className="text-teal-600 dark:text-teal-400 flex-shrink-0" size={14} />
                            <div className="flex-1 min-w-0">
                              {/* The same link as the card's, and the same
                                  reason for hugging: this one reads plain
                                  "Cash", four letters against a row as wide as
                                  its parent's, so a stretched anchor here left
                                  the largest dead zone on the page. */}
                              <p className="text-sm font-medium">
                                <Link
                                  to={registerPath(child.id)}
                                  state={registerLinkState(child.id)}
                                  className={`${ACCOUNT_ROW_NAME_LINK_CLASS} text-gray-800 dark:text-gray-200`}
                                  title={`Open ${child.name}`}
                                >
                                  {childName}
                                </Link>
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">Cash account</p>
                            </div>
                            {/* Phones: the balance beside the name, exactly as
                                the parent card does it, because the Account Bal
                                column is off at that width. */}
                            <span className="sm:hidden shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                              {formatDisplayCurrency(computeAccountBalance(child.id), child.currency)}
                            </span>
                          </div>
                          <AccountRowColumns>
                            {/* Bank Bal: an EMPTY slot, not a missing column. A
                                cash sleeve has no feed of its own — the money
                                arrives through the investment account it belongs
                                to — so there is no bank figure to show and
                                "N/A" would only invite the question. Dropping
                                the column instead would pull every figure after
                                it one place left, which is the misalignment this
                                whole row was rebuilt to end. */}
                            <AccountRowEmptyCell />
                            <AccountBalanceCell
                              label="Account Bal"
                              value={formatDisplayCurrency(computeAccountBalance(child.id), child.currency)}
                              smOnly
                            />
                            <AccountCountCell label="Unreconciled" count={getUnreconciledCount(child.id)} />
                            {/* Its own register means its own arrivals to deal
                                with, so it gets this column too. */}
                            <AccountCountCell label="To Review" count={toReviewByAccount.get(child.id) ?? 0} />
                            {/* Portfolio, feed and settings: not this row's to
                                offer. The slots stay so the Reconcile button
                                lands under its parent's. */}
                            <AccountRowEmptyCell />
                            <AccountRowEmptyCell />
                            <AccountRowEmptyCell />
                            <AccountRowActionSlot>{renderReconcileButton(child)}</AccountRowActionSlot>
                            {/* The chevron says "this row leads somewhere",
                                which it does — through the name beside it.
                                Decoration, so it is hidden from a screen
                                reader, which has the link itself. */}
                            <AccountRowActionSlot>
                              <span aria-hidden="true" className="flex items-center">
                                <ChevronRightIcon size={16} className="text-gray-400 flex-shrink-0" />
                              </span>
                            </AccountRowActionSlot>
                          </AccountRowColumns>
                        </div>
                      );
                    })}
                  </div>
    );
  };

  // The band's own glyph: its section's icon and colour for a type band, the
  // bank mark for an institution band.
  const bandHeadingIcon = (group: AccountDisplayGroup<Account>): ReactNode => {
    if (group.kind === 'institution') {
      return <BankIcon className="text-[#1a2332] dark:text-gray-400" size={20} />;
    }
    const section = accountTypes.find(t => t.type === group.label);
    const Icon = section?.icon ?? WalletIcon;
    return <Icon className={section?.color ?? 'text-gray-600'} size={20} />;
  };

  // ONE renderer for every banded view: a heading that folds the band away,
  // and — when open — either the account cards or, with both switches on, the
  // institution sub-bands holding them. The heading always shows the full
  // band's name, count and total, so a collapsed band still tells you what it
  // is worth.
  //
  // What is IN the band was decided by `displayedList` — the same answer the
  // arrow keys walk, so the two can never differ about which rows exist.
  /**
   * A group header's total, and how it declares that a rate was applied.
   *
   * Three outcomes, in the order they are checked:
   *
   *  1. **Whole in the display currency** — the plain figure this page has
   *     always printed, from the untouched `totalForBand` path, with no mark.
   *     Nothing was converted, so there is nothing to disclose and no reason for
   *     a single-currency ledger to grow a symbol it cannot explain.
   *  2. **A currency in the band has no rate at all** — the FAILURE state. There
   *     is no honest single figure, so the band reports the unsummed pair
   *     ("£X + $Y"). Never the default: it only appears where a rate is
   *     genuinely unresolvable, and the card above it is saying so at the same
   *     moment, out of the same `unconverted` list.
   *  3. **Converted** — the figure, marked `≈`. The mark is the whole
   *     disclosure: WHICH rate and WHEN is stated once per page, by
   *     `ConvertedTotalNote` under the net-worth card, and repeating it per
   *     group would make the scanning aid the widest thing on the row.
   */
  const bandTotalFigure = (key: string, bandAccounts: readonly Account[]): BandTotalFigure => {
    const converted = convertedNetWorth.groupTotals.get(key);

    if (!converted?.isConverted) {
      const plain = formatDisplayCurrency(totalForBand(bandAccounts));
      return { text: plain, spoken: plain };
    }

    if (converted.unconverted.length > 0) {
      const pair = converted.byCurrency
        .map(line => formatDisplayCurrency(line.amount, line.currency))
        .join(' + ');
      return { text: pair, spoken: pair };
    }

    const figure = formatDisplayCurrency(converted.total);
    return { text: `≈ ${figure}`, spoken: `approximately ${figure}` };
  };

  /**
   * The figure as a node. An unmarked total renders as the bare string it
   * always was — same DOM, same textContent — and only a marked one splits into
   * a seen glyph and a spoken word, because `≈` is not reliably announced.
   */
  const bandTotalNode = (figure: BandTotalFigure): ReactNode =>
    figure.text === figure.spoken ? (
      figure.text
    ) : (
      <>
        <span aria-hidden="true">{figure.text}</span>
        <span className="sr-only">{figure.spoken}</span>
      </>
    );

  const renderAccountBand = ({ group, displayed, subBands, isExpanded }: DisplayedBand): ReactNode => {
    const regionId = groupRegionId(group.kind, group.label);
    const bandTotal = bandTotalFigure(bandTotalKey(group.kind, group.label), group.accounts);

    return (
      // NOT A CARD. This used to be a white bordered, shadowed box containing a
      // grey band containing white rows — three nested containers to say one
      // thing (DESIGN_PASS_2026-08 §3.3). Per P4 a group is separated by WEIGHT
      // and SPACE before it is separated by a box: the heading is a quiet caps
      // label on #f8f9fb with the band's total opposite it, the rows sit
      // directly on white below, and the 24px between one band and the next is
      // the `gap-6` of the grid this returns into. One border and one shadow
      // fewer per group.
      <div key={`${group.kind}:${group.label}`}>
        <button
          type="button"
          onClick={() => toggleGroupCollapsed(collapseKeyFor(group.kind, group.label))}
          aria-expanded={isExpanded}
          aria-controls={regionId}
          className="w-full bg-surface-secondary dark:bg-gray-700/50 border-b border-line dark:border-gray-700 px-4 sm:px-6 py-2.5 text-left transition-colors duration-state hover:bg-surface-tertiary dark:hover:bg-gray-700"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <ChevronRightIcon
                size={16}
                className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
              {bandHeadingIcon(group)}
              {/* Caps label, not a heading-sized title: the band's name is a
                  label for the figure beside it, and the figure is the thing
                  worth reading (P1). Still an h2 — the outline, and the way a
                  screen-reader user walks this page, are unchanged. */}
              <h2 className="text-label uppercase font-semibold text-gray-600 dark:text-gray-300">{group.title}</h2>
              <span className="text-dense text-gray-400 dark:text-gray-500">
                ({group.accounts.length} {group.accounts.length === 1 ? 'account' : 'accounts'})
              </span>
            </div>
            <p className="text-card font-semibold text-primary dark:text-white">
              {bandTotalNode(bandTotal)}
            </p>
          </div>
        </button>

        {isExpanded && (
          <div id={regionId} className="bg-white dark:bg-gray-800">
            {subBands
              ? subBands.map(sub => {
                  // Count and total describe the WHOLE sub-band, as the section
                  // header does — a search narrows the rows, not the figures.
                  const countLabel = `${sub.accounts.length} ${sub.accounts.length === 1 ? 'account' : 'accounts'}`;
                  const subTotal = bandTotalFigure(
                    subBandTotalKey(group.kind, group.label, sub.label),
                    sub.accounts
                  );
                  return (
                    // A sub-band is a group, not a heading: the outline stays
                    // section (h2) → account name (h3), and screen readers get
                    // the institution, its count and its total from the label.
                    <div
                      key={sub.label}
                      role="group"
                      aria-label={`${sub.title}, ${countLabel}, total ${subTotal.spoken}`}
                    >
                      {/* The same treatment as the band above it, one step
                          quieter: a line, not a pill with a border of its own. */}
                      <div className="flex items-center justify-between gap-2 border-b border-line dark:border-gray-700 bg-surface-secondary/60 dark:bg-gray-700/30 px-4 sm:px-6 py-1.5">
                        <p className="text-label uppercase font-semibold text-gray-500 dark:text-gray-400 truncate">
                          {sub.title}
                          <span className="ml-2 font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                            ({countLabel})
                          </span>
                        </p>
                        <p className="shrink-0 text-dense font-semibold text-gray-600 dark:text-gray-300">
                          {/* The container already carries the spoken form in
                              its group label, so the mark is decoration here. */}
                          <span aria-hidden="true">{subTotal.text}</span>
                        </p>
                      </div>
                      {sub.displayed.map(renderAccountCard)}
                    </div>
                  );
                })
              : displayed.map(renderAccountCard)}
          </div>
        )}
      </div>
    );
  };

  // ONE quiet row for a closed account: name, institution, balance, a settings
  // button and a Reopen button. Deliberately not the full open-account card —
  // the archive stays subdued (muted text, no sync/reconcile/close actions).
  const renderClosedAccountRow = (account: Account): ReactNode => {
    // Settings without reopening: checking (or correcting) a closed account's
    // name or opening date used to cost a reopen–edit–close round trip for one
    // fact. Deliberately NOT a route into the register — the archive stays an
    // archive, so seeing its transactions still means reopening the account.
    const settingsLabel = `Account settings for ${account.name}`;
    return (
      <div key={account.id} className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
            {account.name}
          </p>
          {account.institution && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {account.institution}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {formatDisplayCurrency(account.balance, account.currency)}
          </p>
          <IconButton
            onClick={() => setSettingsAccountId(account.id)}
            icon={<SettingsIcon size={16} />}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title={settingsLabel}
            aria-label={settingsLabel}
          />
          <button
            onClick={() => void handleReopenAccount(account.id)}
            disabled={reopeningId !== null}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reopeningId === account.id ? 'Reopening…' : 'Reopen'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <PageWrapper
      title="Accounts"
      rightContent={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white text-sm font-medium rounded-lg hover:bg-[#2d3a4d] transition-colors shadow-sm"
          title="Add Account"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Account
        </button>
      }
    >


      {/* Desktop: the net-worth summary + controls stay pinned while the
          account list scrolls in its own region — Add Account, view switches
          and the totals remain reachable from anywhere in a long list. */}
      <div className="lg:flex lg:flex-col lg:h-[calc(100vh-13rem)]">
      <div className="lg:shrink-0">
      {/* Net Worth Summary Bar */}
      {!isLoading && accounts.length > 0 && (() => {
        const totalBalance = calculateTotalBalance(decimalAccounts, decimalTransactions);
        const totalAssets = decimalAccounts
          .filter(a => {
            const bal = computeAccountBalance(a.id);
            return bal > 0;
          })
          .reduce((sum, a) => sum + computeAccountBalance(a.id), 0);
        const totalLiabilities = decimalAccounts
          .filter(a => {
            const bal = computeAccountBalance(a.id);
            return bal < 0;
          })
          .reduce((sum, a) => sum + Math.abs(computeAccountBalance(a.id)), 0);

        // ONE card, three columns, hairline dividers — not a navy slab and two
        // white cards, which read as one important thing and two afterthoughts
        // when it is one figure and the two halves it is made of
        // (DESIGN_PASS_2026-08 §3.3). The same component draws the Dashboard's,
        // so the two surfaces cannot disagree about what net worth looks like.
        //
        // All three are formatted WITHOUT an account currency, i.e. in the
        // display currency: a total over accounts that need not share a
        // currency belongs to none of them in particular. The rows below keep
        // showing each account's own — which is what settles the mismatch the
        // two rows of cards used to have between them.
        //
        // Each figure still drills into the accounts behind it.
        return (
          <div className="mb-6">
            <NetWorthSummary
              // Converted figures ONLY when a second currency is actually in
              // play. A single-currency ledger keeps the exact arithmetic it
              // had — same functions, same number — so this change is invisible
              // to everyone it does not concern.
              netWorth={formatDisplayCurrency(spansCurrencies ? convertedNetWorth.netWorth : totalBalance)}
              assets={formatDisplayCurrency(spansCurrencies ? convertedNetWorth.assets : totalAssets)}
              liabilities={formatDisplayCurrency(spansCurrencies ? convertedNetWorth.liabilities : totalLiabilities)}
              onSelect={figure => setBreakdownView(figure)}
              provenance={spansCurrencies ? convertedNetWorth.provenance : null}
              unconverted={spansCurrencies ? convertedNetWorth.unconverted : []}
              displayCurrency={displayCurrency}
            />
          </div>
        );
      })()}

      {/* Group + sort controls, with bank connections on the right.
          ─ WHICH LABEL GOES WITH WHICH CONTROL ────────────────────────────
          The gap BEFORE a label has to beat the gap AFTER it, or the eye files
          the label with the group it has just finished reading. "Sort:" used to
          fail that test: its label box was a fixed w-20 while the word is about
          half that, so 50-odd pixels of nothing sat between "Sort:" and its own
          Default button while only 24 separated it from the Institution button
          before it — and it read as Institution's caption.
          The fixed width now applies ONLY below sm, where the two rows stack
          and it is what lines the pill groups up under each other; side by side
          each label is its own width, 8px from its controls and 32 from the
          group before. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-4">
        {/* w-full below sm: each control needs to OWN its row for the pill
            group inside to stretch — as content-sized flex items the two
            rows ended at different x and the pills could not line up.

            Group by is two INDEPENDENT switches rather than an either/or pair:
            on their own they band the list one way, together they nest
            institutions inside the type sections, and off they leave one flat
            list. The p-0.5 is not decoration — it matches the height the Sort
            group gets from its own border and padding, so the two rows line up. */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          {/* Semibold, and a grade darker: these two words are the only thing
              telling anyone what the row of pills beside them does, and at
              gray-500/normal they read as a footnote to the buttons rather than
              as their name. */}
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 w-20 sm:w-auto shrink-0">Group by:</span>
          <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex gap-2 p-0.5">
            <button
              type="button"
              onClick={() => handleGroupingChange({ ...grouping, byType: !grouping.byType })}
              aria-pressed={grouping.byType}
              title="Band the list into account-type sections"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                grouping.byType
                  ? 'bg-[#1a2332] dark:bg-blue-600 border-[#1a2332] dark:border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Account Type
            </button>
            <button
              type="button"
              onClick={() => handleGroupingChange({ ...grouping, byInstitution: !grouping.byInstitution })}
              aria-pressed={grouping.byInstitution}
              title="Band the list by institution"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                grouping.byInstitution
                  ? 'bg-[#1a2332] dark:bg-blue-600 border-[#1a2332] dark:border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Institution
            </button>
          </div>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 w-20 sm:w-auto shrink-0">Sort:</span>
          <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              onClick={() => handleSortChange('default')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'default'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Default
            </button>
            <button
              onClick={() => handleSortChange('name')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'name'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Name A–Z
            </button>
            <button
              onClick={() => handleSortChange(sortMode === 'balance-desc' ? 'balance-asc' : 'balance-desc')}
              title={sortMode === 'balance-desc'
                ? 'Sorted highest value first — click for lowest first'
                : sortMode === 'balance-asc'
                  ? 'Sorted lowest value first — click for highest first'
                  : 'Sort by account value'}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'balance-desc' || sortMode === 'balance-asc'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Value {sortMode === 'balance-asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        {/* Search — the way to find one account among two hundred. On a
            phone it takes the first row, full width; the pills follow.

            GROWS into whatever the toolbar has spare, rather than sitting at a
            fixed 224px with a corridor of nothing between it and Refresh feeds.
            basis-56 is the size it falls back to, so when the window is too
            narrow to hold everything the row WRAPS at the old width instead of
            squeezing the box down to a slot too small to read a bank's name
            in. */}
        <div className="order-first basis-full sm:order-none sm:basis-56 sm:grow flex items-center gap-2">
          <label htmlFor="account-search" className="sr-only">Search accounts by name or institution</label>
          {/* min-w-0 so the growing/shrinking happens to the box rather than
              being refused by the input's own intrinsic width. */}
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input
              id="account-search"
              type="search"
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search accounts…"
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {isSearching && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" aria-live="polite">
              {matchedTopLevelCount} of {topLevelAccounts.length} accounts
            </span>
          )}
        </div>
        <div className="basis-full sm:basis-auto sm:ml-auto flex items-center gap-2">
          <BankingCriticalIncidentBadge onClick={() => setBankConnectionsView('critical')} />
          <BankingCriticalIncidentBadge mode="truelayer_jwks" onClick={() => setBankConnectionsView('jwks')} />
          {/* One hit for every feed — the per-account buttons remain for a
              single stubborn connection. Rendered whenever any connection
              exists so the toolbar's shape stays put. */}
          {connectedCount > 0 && (
            <button
              onClick={() => void syncAllConnections()}
              disabled={isSyncingAny}
              className="w-full sm:w-auto justify-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
              title="Pull fresh data from every connected bank"
            >
              <RefreshCwIcon size={16} className={isSyncingAny ? 'animate-spin' : ''} />
              {isSyncingAny ? 'Refreshing…' : 'Refresh feeds'}
            </button>
          )}
          <button
            onClick={() => setBankConnectionsView('plain')}
            className="w-full sm:w-auto justify-center px-3 py-1.5 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <BankIcon size={16} />
            Bank Connections
          </button>
        </div>
      </div>

      </div>{/* end pinned chrome */}

      {/* THE SCROLL REGION CLIPS SIDEWAYS TOO, WHICH IS WHY IT IS PADDED.
          `overflow-y: auto` cannot be had on its own: CSS promotes the other
          axis from `visible` to `auto` whenever one axis is not visible, so this
          box clips horizontally whether or not anything asked it to. The rows
          inside it are the full width of its content box, and the selected row's
          ring is a box-shadow drawn 1px OUTSIDE its border box — off the end of
          the content box, and therefore cut away. Measured at 1280px: the row
          and the content box both began at x=32, so the ring's left stroke had
          nowhere to land and vanished, while `pr-1` on the right had always
          given that side 4px to paint into. One edge of the ring missing is the
          "the border disappears on the left" half of the same bug report.

          `-ml-1 pl-1` buys the missing room WITHOUT moving anything: the box
          grows 4px leftward into the page gutter (32px of it there, and no
          clipping ancestor above — checked) and pads the 4px straight back, so
          every row stays at exactly the x it had. 4px is the figure the right
          side already uses and it covers the ring (1px) with room to spare for
          the lift, whose horizontal reach is ~4.5px at its widest layer. */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-ml-1 lg:pl-1 lg:pr-1">
      {/* Accounts grid */}
      <div className="grid gap-6">
        {isLoading ? (
          /* SHAPE, NOT SPINNER (DESIGN_PASS §4). Three rows at the height an
             account row actually is, in the two tracks it actually has — the
             name on the left, the balance right-aligned — so the list does not
             jump when the accounts arrive. It replaced three 192px cards that
             matched no row on this page and breathed while they waited. */
          <div className="bg-white dark:bg-gray-800">
            <TableSkeleton columns={ACCOUNT_SKELETON_COLUMNS} rowHeight={ACCOUNT_ROW_HEIGHT} />
          </div>
        ) : displayedList.mode === 'flat' ? (
          /* Both switches off: one list, no band chrome at all — the rows on
             white, separated by the same hairline the banded views use. */
          <div className="bg-white dark:bg-gray-800">
            {displayedList.accounts.map(renderAccountCard)}
          </div>
        ) : (
          displayedList.bands.map(renderAccountBand)
        )}
      </div>

      {/* A SEARCH THAT HIDES EVERY ACCOUNT IS NOT AN EMPTY ACCOUNT LIST
          (DESIGN_PASS §4). On a finance app the two look identical and one of
          them is terrifying, so this one names how many accounts are still
          there, what is hiding them, and the control that gives them back.
          Search is the only thing on this page that hides a row: the group and
          sort switches rearrange the list, and closed accounts have their own
          section below rather than being filtered out of this one. */}
      {!isLoading && isSearching && matchedTopLevelCount === 0 && openAccounts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <FilteredEmptyState
            title="No accounts match your search"
            hiddenCount={topLevelAccounts.length}
            scope="of your accounts"
            filters={[`Search: ${accountSearch.trim()}`]}
            onClear={() => setAccountSearch('')}
          />
        </div>
      )}

      {/* Gated on !isLoading, which it was not. The window is small — this
          page's isLoading is local and drops on the first effect pass — but
          for that first paint "No accounts yet" rendered directly beneath the
          loading placeholder, which is the page contradicting itself about
          whether the user has any accounts. The two are now mutually exclusive
          by construction rather than by how fast an effect runs. */}
      {!isLoading && openAccounts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <EmptyState
            title="No accounts yet"
            description="Every balance, report and budget in WealthTracker is built up from accounts, so until there is one here the rest of the app has nothing to show."
            action={{ label: 'Add Account', onClick: () => setIsAddModalOpen(true) }}
          />
        </div>
      )}

      {/* Closed Accounts (Microsoft Money model: hidden, never deleted) */}
      {closedAccounts.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowClosedAccounts(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              {showClosedAccounts ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
              Closed Accounts ({closedAccounts.length})
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              History preserved — reopen any time
            </span>
          </button>

          {showClosedAccounts && (
            <div data-testid="closed-accounts" className="border-t border-gray-100 dark:border-gray-700">
              {/* Grouped exactly like the open list — both switches included,
                  so an institution sub-band nests here too — but kept quiet: a
                  small grey subheading per group, rows alphabetical within. A
                  subheading is not a semantic <h2> here; it sits below the open
                  sections' weight on purpose, an archive rather than the main
                  event. With both switches off there is no subheading at all. */}
              {closedAccountBands.mode === 'flat' ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {closedAccountBands.accounts.map(renderClosedAccountRow)}
                </div>
              ) : (
                closedAccountBands.groups.map(group => (
                  <div key={`${group.kind}:${group.label}`}>
                    <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {group.title}
                    </p>
                    {group.subGroups ? (
                      group.subGroups.map(sub => (
                        <div key={sub.label}>
                          <p className="pl-8 pr-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400/90 dark:text-gray-500/90">
                            {sub.title}
                          </p>
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {sub.accounts.map(renderClosedAccountRow)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {group.accounts.map(renderClosedAccountRow)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      </div>{/* end scroll region */}
      </div>{/* end desktop flex column */}

      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Bank Connections Modal (badge clicks preset the ops filters) */}
      {bankConnectionsView !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setBankConnectionsView(null); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Connections</h2>
              <button
                onClick={() => setBankConnectionsView(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close bank connections"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <Suspense fallback={<LoadingState />}>
                <BankConnections
                  onAccountsLinked={() => { void refreshAccountsAndTransactions(); }}
                  defaultOpsOnlyAboveThreshold={bankConnectionsView !== 'plain'}
                  defaultOpsEventTypePrefix={bankConnectionsView === 'jwks' ? TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX : undefined}
                  defaultOpenOpsAuditLog={bankConnectionsView === 'critical'}
                  defaultOpsAuditStatus={bankConnectionsView === 'critical' ? 'failed' : undefined}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {/* Portfolio View Modal */}
      {portfolioAccountId && (() => {
        const account = accounts.find(a => a.id === portfolioAccountId);
        if (!account || !account.holdings) return null;
        
        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setPortfolioAccountId(null); }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <PortfolioView
                  accountId={portfolioAccountId}
                  accountName={account.name}
                  holdings={account.holdings}
                  currency={account.currency}
                  onClose={() => setPortfolioAccountId(null)}
                />
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Account Settings Modal — serves the open cards AND the closed rows, so
          the account can come from either list. A closed account is not in
          context state (it is loaded separately), hence the second lookup. */}
            <AccountBreakdownModal
        view={breakdownView}
        onClose={() => setBreakdownView(null)}
        rows={decimalAccounts.map(a => ({
          id: a.id,
          name: a.name,
          institution: a.institution,
          accountType: a.type,
          balance: computeAccountBalance(a.id),
          formatted: formatDisplayCurrency(computeAccountBalance(a.id), a.currency),
        }))}
        formatTotal={(v) => formatDisplayCurrency(v)}
        // Through the same door as a click on an account's name, provenance and
        // all: coming back from a register opened here lands on that account's
        // row rather than at the top of the list.
        onOpenAccount={(accountId) => {
          setBreakdownView(null);
          openAccount(accountId);
        }}
      />

      <AccountSettingsModal
        isOpen={!!settingsAccountId}
        onClose={() => setSettingsAccountId(null)}
        account={
          accounts.find(a => a.id === settingsAccountId)
          ?? closedAccounts.find(a => a.id === settingsAccountId)
          ?? null
        }
        // The open accounts, which is what the pairing field pairs with: a
        // closed investment account is not somewhere money can be filed.
        accounts={openAccounts}
        // Whether the CURRENCY field is still editable. Asked of the whole
        // transaction list rather than this page's balance views, because
        // archived rows count as history and those views hide them.
        hasTransactions={settingsAccountId ? accountHasHistory(transactions, settingsAccountId) : undefined}
        onSave={async (accountId, updates) => {
          // A closed account isn't in context state, so the context's in-place
          // patch lands on nothing — reopening one from here only reaches the
          // live list after a re-pull.
          const wasClosed = closedAccounts.some(a => a.id === accountId);
          await updateAccount(accountId, updates);
          if (wasClosed && updates.isActive === true) {
            await refreshAccountsAndTransactions();
          }
          // Closing/reopening (or renaming) via settings also updates the
          // account's transfer category via the DB trigger — keep the Closed
          // Accounts section and category dropdowns in sync without a reload.
          if (updates.isActive !== undefined) {
            await loadClosedAccounts();
          }
          if (updates.isActive !== undefined || updates.name !== undefined) {
            await refreshCategories();
          }
        }}
      />

      <PageTip
        id="accounts-intro"
        title="Manage your accounts"
        description="Add bank accounts, credit cards, savings, and investments. Click an account's name to open its transactions, or click the row to pick it out and walk the list with the arrow keys. Use the settings icon on each account to configure alerts and reconciliation."
      />
    </PageWrapper>
  );}
  