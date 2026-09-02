import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import CategorySelector from './CategorySelector';
import AccountSelector, { type SelectableAccount } from './common/AccountSelector';
import DatePicker from './common/DatePicker';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useAccountNames } from '../hooks/useAccountNames';
import { useHistoricalAccounts } from '../hooks/useHistoricalAccounts';
import { getDateLocale } from '../utils/dateFormatter';
import { isDanglingFiling } from '../utils/categoryHealth';
import { AlertTriangleIcon, PlusIcon, XIcon } from './icons';
import type { Transaction } from '../types';
import { formatCount, compareNames } from '../utils/localeFormat';

/**
 * Filter and file — the engine both categorising surfaces are made of.
 *
 * ── ONE TOOL, TWO POPULATIONS (owner, 1 Sep 2026) ───────────────────────────
 *
 * The same question — "find me these rows and file the lot in one press" — is
 * asked on two pages about two disjoint sets of transactions:
 *
 *   Accounts → Categorisation   rows that still want somebody's eyes. The
 *                               FIRST filing: an import's backlog, a feed's
 *                               guesses nobody has agreed with.
 *   Settings → Categories       rows already filed. HOUSEKEEPING, for the
 *                               commonest case in a long ledger — a category
 *                               made this month, and three years of rows that
 *                               belong in it sitting in "Personal spending"
 *                               because that is where everything went before
 *                               it existed.
 *
 * So there is one component and two mounts, each handing in its own population
 * and its own words. The populations are complements of each other, so the two
 * pages can never disagree about what has been dealt with — and a fix lands on
 * both of them or on neither, which is the only way two tools this alike stay
 * honest about one another.
 *
 * The other two ways through Categorisation are NOT replaceable by a filter
 * list, and the owner's reasoning is worth keeping: "Match transfers" works in
 * equal-and-opposite PAIRS across two accounts, and a list that shows one row
 * at a time cannot see the other side of a ⇄; "Categorise by payee" arrives
 * already grouped by merchant and teaches future imports as it files. This
 * list replaced the third card — "review one by one" — which is precisely the
 * job a search and a tick do better.
 *
 * ── THE FILTERS STACK, AND NOTHING IS SEARCHED UNTIL ONE IS SET ─────────────
 *
 * Rows AND together, because the driving question is a compound one: "the
 * Tesco rows I dumped in Personal spending", not "everything in Personal
 * spending" and not "everything that says Tesco". Nothing is listed until at
 * least one filter carries a value — a ledger of fifty thousand rows rendered
 * because a panel was opened is not an answer to any question.
 *
 * ── MIXED DIRECTIONS ARE ALLOWED (owner's ruling) ───────────────────────────
 *
 * Every picker here offers both directions whatever the row's own direction
 * is: a refund belongs under the expense category it refunds, and a
 * charge reversed into an income category is a filing somebody meant. What
 * keeps a mixed selection legible is the register's own colour and sign on
 * every amount — money out red and signed −, money in green and signed + — so
 * nobody bulk-files a receipt as a cost without seeing that they have.
 *
 * ── THE HOUSE CONTROLS, NOT PLAIN BOXES (owner, 1 Sep 2026) ─────────────────
 *
 * Every picker here is the one the register uses: the searchable category
 * combobox, the banded account combobox, the app's own calendar. This shipped
 * with native selects and native date inputs, and the owner's report was the
 * whole argument against them — the calendar "doesn't look like our normal
 * calendar", and a category could not be found by typing "just like you can
 * start typing when editing a transaction". A tool for a fifteen-year ledger
 * cannot ask people to scroll a flat list of four hundred categories.
 *
 * So the accounts band the way the ACCOUNTS PAGE bands them (type sections in
 * page order, institutions nested inside), and the category filter offers
 * groups as well as leaves — rows are filed directly on groups, sometimes
 * thousands of them, and a filter that could not name a group could not find
 * them. The two pickers that FILE a row still offer leaves alone: a
 * transaction belongs to a leaf.
 *
 * The trigger names whatever a row is already filed under, offered or not — a
 * revaluation category, an account's To/From, a group. A filing pointing at a
 * category that no longer EXISTS has no name to draw, so that row says so in
 * words beside its picker instead of showing an empty box. The one thing a
 * control here may never do is draw a row as something it is not.
 *
 * ── A FILTER ROW STACKS ON A PHONE (owner, 1 Sep 2026) ──────────────────────
 *
 * Side by side, the kind selector wants the width of "Words in the description
 * or notes" and the value box gets whatever is left — which on a phone was a
 * field a few characters wide, from the owner's own screenshot. Below `sm` the
 * two go on their own lines instead, the value indented under the kind that
 * governs it, with the remove ✕ staying on the top line where the thumb
 * expects it. At `sm` and up the wrapper dissolves (`display: contents`, the
 * Accounts toolbar's own trick) and the row is the flex row it always was.
 *
 * ── ONE FILTER IS CHOSEN RATHER THAN FILLED IN (owner, 1 Sep 2026) ──────────
 *
 * "Filed under a category that no longer exists" takes no value: picking the
 * kind IS the instruction, so it counts as a search the moment it is chosen and
 * its row has no second line to stack on a phone. Every other kind asks for a
 * word, a category, an account, a range; this one asks for nothing because
 * there is nothing to name — the category is gone, which is the whole
 * complaint.
 *
 * WHAT IT CANNOT SHOW, IT NAMES (owner, 1 Sep 2026). The count that sends a
 * reader here is measured over SPLIT-EXPANDED rows, and a line inside a split is
 * filed in its parent — no press in this list can write to one. So a panel
 * saying three over a list holding two would be the unexplained counter gap the
 * owner has ruled against twice; the mount hands down how many of them are split
 * lines (from the SAME measure the count came off — see categoryHealth) and the
 * list says so beneath the results. The two numbers are then one arithmetic
 * rather than two definitions that happen to agree.
 *
 * It exists because those rows were ANNOUNCED in two places and reachable from
 * neither. Accounts → Categorisation said "N of these are filed under a
 * category that no longer exists, repair them under Manage → Categories";
 * Manage → Categories said "N rows point at a category that no longer exists"
 * and offered a link back to Categorisation. Each end pointed at the other and
 * the rows were never on screen. The owner's ruling closed it: a dangling row
 * HAS a category — a dead one — so putting it right is a CHANGE to something
 * already filed, which is this tool's housekeeping mount. The population there
 * already held those rows and the picker already said so beside them; what was
 * missing was the way to find them, and this is it. Both former ends of the
 * loop now land here (see utils/categoryRefileLink).
 *
 * ── WHAT A CHANGE WRITES, AND WHAT IT NEVER DOES ────────────────────────────
 *
 * Exactly the three fields of a filing: the category, and the two flags that
 * say a human filed it (1 Sep ruling — filing ends review). Nothing here
 * deletes: a re-filing is not a removal, and the tool that can lose you a row
 * is Find duplicates, which asks about one pair at a time for that reason.
 *
 * The bulk change asks before it runs and can be taken back afterwards — one
 * shot, held for the sitting, because the undo exists for the press that was
 * wrong the moment it landed. It is not history; the next search clears it.
 */

/** Above this many matches the list stops drawing and says so. */
const DISPLAY_CAP = 200;

/**
 * The words and the one rule that differ between the two mounts.
 *
 * Everything a reader of ONE page could be misled by lives here: which verb
 * the press uses, what it says it will do, what it says it did not search.
 * Nothing about the mechanism does — a mount cannot change what a filing
 * writes, what is excluded, or how the undo behaves, because those are the
 * properties both pages are trusted for.
 */
export interface FilterAndFileCopy {
  /** The bulk press's verb, in its button, its question and its confirmation. */
  bulkVerb: string;
  /** The same verb while the run is going out, row by row. */
  bulkGerund: string;
  /** What that press will do, said in its own numbers before it runs. */
  bulkConsequence: (count: number, categoryName: string) => React.ReactNode;
  /** What became of the rows the ledger refused, said after it ran. */
  bulkFailed: (count: number) => string;
  /** What the one shot back has just done. */
  undone: (count: number) => React.ReactNode;
  /** The toast title after one row is saved on its own. */
  savedTitle: string;
  /** Said when the filters caught nothing at all in this population. */
  nothingMatched: (activeFilters: number) => string;
  /** Said beneath the results when the same filters caught transfers. */
  transfersExcluded: (count: number) => string;
  /** The standing note under the results, where the mount has one. */
  footnote?: React.ReactNode;
  /**
   * May a row be saved under the category it already carries?
   *
   * True where the population is rows awaiting review: agreeing with the app's
   * guess IS the decision, and it writes the same three fields as changing it.
   * False where every row is already filed and confirmed — there a save that
   * changed nothing would be a press with no consequence.
   */
  filesUnchangedRows?: boolean;
}

/**
 * A filter another surface can ask for on the reader's behalf.
 *
 * Presence-only kinds and nothing else, which is not an arbitrary narrowing: a
 * preset of any other kind would arrive as an EMPTY BOX, and an empty box is
 * not a search — nothing is listed until a filter carries a value, so the
 * reader would be handed an open panel and no rows, which is the failure this
 * whole path exists to end.
 */
export type PresetFilterKind = 'dangling';

export interface FilterAndFilePreset {
  kind: PresetFilterKind;
  /**
   * Changes on every ask, so asking twice works twice — the `openSearchToken`
   * idiom the house pickers already use. Without it a second press after the
   * reader had changed the search would do nothing at all.
   */
  token: number;
}

interface FilterAndFileListProps {
  /**
   * Whether the body is drawn. The component stays MOUNTED when it is not, so
   * a panel that is hidden and shown again is the search the reader left —
   * each mount owns its own disclosure control and its own always-visible
   * chrome, which is the only part of these two surfaces that differs in shape.
   */
  open: boolean;
  /**
   * Which rows this mount searches, asked of the ledger row by row. Transfers
   * never belong in a population — they take no category at all.
   *
   * A PREDICATE rather than a list, and the reason is the bulk press: this
   * component re-renders itself once per write while a run goes out, and every
   * one of those renders has to see the ledger as it NOW is. That is what
   * empties the search as the rows it found take their new category — the
   * proof that the press worked. A list handed down by a parent that did not
   * re-render would be the search as it stood before the first write.
   */
  population: (transaction: Transaction) => boolean;
  copy: FilterAndFileCopy;
  /** The mount's own heading and note, drawn at the top of the body. */
  header?: React.ReactNode;
  /** The box the body sits in, where the mount wants one. */
  className?: string;
  /**
   * A search this mount has been asked to run for the reader — today the rows
   * whose category no longer exists, asked for by the data-health panel above
   * the housekeeping mount or by the link that arrives from Categorisation.
   *
   * It REPLACES the filters rather than adding to them: the request is "show me
   * those rows", and a leftover filter from a previous question would quietly
   * hide some of them. Everything answering the old question goes with it,
   * exactly as it does when the reader changes a filter themselves.
   */
  preset?: FilterAndFilePreset | null;
  /**
   * How many rows whose category no longer exists are LINES INSIDE SPLITS, and
   * therefore cannot appear in this list at all — measured by the same pass that
   * produced the count which sent the reader here (`CategoryHealth`), never
   * recounted, so the panel's number and these rows are two halves of one sum.
   *
   * Named beneath the results whenever the dangling filter is the search, INCLUDING
   * when it matched nothing at all: a list saying "no transaction matches" under a
   * panel promising one is the exact moment the sentence is worth most. Zero says
   * nothing, and a mount that never has split lines to declare passes nothing.
   */
  danglingSplitLines?: number;
}

type FilterKind = 'text' | 'category' | 'account' | 'date' | 'amount' | 'tag' | 'dangling';

/**
 * One filter row.
 *
 * Every kind's value lives on the same shape rather than in a union, so
 * switching a row's kind and switching back costs the user nothing they typed
 * — the same reason the payee sweep's transfer toggle keeps the category
 * underneath it. Only the fields the current kind reads are ever consulted.
 */
interface Filter {
  id: string;
  kind: FilterKind;
  text: string;
  categoryId: string;
  accountId: string;
  /** Inclusive, as `yyyy-mm-dd` — what the house calendar hands over. */
  from: string;
  to: string;
  /** Amount bounds, matched against the SIZE of the row (see rowMatches). */
  min: string;
  max: string;
  tag: string;
}

const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  text: 'Words in the description or notes',
  category: 'Current category',
  account: 'Account',
  date: 'Date range',
  amount: 'Amount',
  tag: 'Tag',
  dangling: 'Filed under a category that no longer exists',
};

/**
 * What the reader chose in the kind selector, as a kind — asked of the labels
 * above rather than listed a second time, so a kind added there is offered,
 * selectable and matched without a third place to remember. `hasOwnProperty`
 * rather than `in`: everything on Object.prototype answers `in`.
 */
const isFilterKind = (value: string): value is FilterKind =>
  Object.prototype.hasOwnProperty.call(FILTER_KIND_LABELS, value);

/** Distinct keys for filter rows, which have no natural identity of their own. */
let filterSeq = 0;

const newFilter = (kind: FilterKind = 'text'): Filter => ({
  id: `filter-${++filterSeq}`,
  kind,
  text: '',
  categoryId: '',
  accountId: '',
  from: '',
  to: '',
  min: '',
  max: '',
  tag: '',
});

/**
 * The calendar day a row falls on, as `yyyy-mm-dd` in the reader's own zone.
 *
 * Built from the local parts rather than from `toISOString`, which would move
 * a late-evening row to the next day for anyone east of Greenwich and to the
 * previous one for anyone west — and compared as text, which sorts the same
 * way the date is written, so a range check needs no arithmetic at all.
 */
const dayKey = (date: Date | string): string => {
  const value = new Date(date);
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

/**
 * An amount bound as the user typed it, or null when there is no bound.
 *
 * Always a magnitude: people think "£12.99", not "−12.99", and a bound that
 * behaved differently for money in and money out would be a trap on a screen
 * that deliberately shows both.
 */
const boundOf = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.abs(value) : null;
};

/** Is this row an instruction yet, or an empty box? */
const filterHasValue = (filter: Filter): boolean => {
  switch (filter.kind) {
    case 'text':
      return filter.text.trim() !== '';
    case 'category':
      return filter.categoryId !== '';
    case 'account':
      return filter.accountId !== '';
    case 'date':
      return filter.from !== '' || filter.to !== '';
    case 'amount':
      return boundOf(filter.min) !== null || boundOf(filter.max) !== null;
    case 'tag':
      return filter.tag !== '';
    // Chosen, therefore asked: this kind has no box to fill in, so the moment
    // it is picked it is a search (see the note at the top of the file).
    case 'dangling':
      return true;
  }
};

/**
 * One row against one filter. Applied to transfers as well as to the
 * population, so the exclusion below can be counted and said out loud rather
 * than being a silent shortfall in the results.
 *
 * `filingHasNoName` is handed in rather than derived here because it needs the
 * category tree, which is the component's. It is the SAME predicate the rows
 * draw their amber note from — see isDanglingFiling.
 */
const rowMatches = (
  transaction: Transaction,
  filter: Filter,
  filingHasNoName: (categoryId: string) => boolean
): boolean => {
  switch (filter.kind) {
    case 'text': {
      // Description OR notes — asked separately rather than of the two joined,
      // because a search that spanned the join would match across a boundary
      // no reader can see.
      const needle = filter.text.trim().toLowerCase();
      return (transaction.description ?? '').toLowerCase().includes(needle)
        || (transaction.notes ?? '').toLowerCase().includes(needle);
    }
    case 'category':
      return transaction.category === filter.categoryId;
    case 'account':
      return transaction.accountId === filter.accountId;
    case 'date': {
      const day = dayKey(transaction.date);
      return (filter.from === '' || day >= filter.from)
        && (filter.to === '' || day <= filter.to);
    }
    case 'amount': {
      const size = Math.abs(transaction.amount);
      const min = boundOf(filter.min);
      const max = boundOf(filter.max);
      return (min === null || size >= min) && (max === null || size <= max);
    }
    case 'tag':
      return (transaction.tags ?? []).includes(filter.tag);
    case 'dangling':
      return filingHasNoName(transaction.category);
  }
};

/** The filing a row carried before a bulk change, so it can be given back. */
interface PreviousFiling {
  id: string;
  category: string;
  categoryConfirmed?: boolean;
  needsReview?: boolean;
}

/** A run in flight — the same shape for a change and for undoing one. */
interface Progress {
  done: number;
  total: number;
}

const shortDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString(getDateLocale(), {
    day: '2-digit', month: 'short', year: '2-digit',
  });

export default function FilterAndFileList({
  open,
  population,
  copy,
  header,
  className,
  preset = null,
  danglingSplitLines = 0,
}: FilterAndFileListProps): React.JSX.Element {
  const { transactions, categories, accounts, updateTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  // Closed accounts included: most of a long history's re-filing is in
  // accounts that were shut years ago, and every one of them has a name.
  const accountName = useAccountNames();
  // The same accounts as ACCOUNTS rather than as names, because the picker
  // bands by type and institution: a current account that was closed in 2014 is
  // still a current account, and filing it under "Other" would be a fact the
  // Accounts page disagrees with.
  const historicalAccounts = useHistoricalAccounts(accounts);

  const [filters, setFilters] = useState<Filter[]>(() => [newFilter()]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Per-row picks, keyed by transaction id, until each is saved. */
  const [rowChoices, setRowChoices] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [changing, setChanging] = useState<Progress | null>(null);
  const [undoing, setUndoing] = useState<Progress | null>(null);
  /** What the last bulk change did, until the next search or press. */
  const [summary, setSummary] = useState<{ changed: number; failed: number; categoryId: string } | null>(null);
  /** The one shot back. Emptied by the next search, and by using it. */
  const [undoable, setUndoable] = useState<PreviousFiling[]>([]);
  const [undoneCount, setUndoneCount] = useState<number | null>(null);

  /**
   * A press is in flight, so every button and plain field goes quiet.
   *
   * The three house pickers do NOT — they have no disabled state, here or at
   * any other call site (the payee sweep leaves its own live through an apply
   * for the same reason). Nothing rides on it: a run takes its rows and its
   * category before the first write, so a filter or a picker changed halfway
   * through cannot reach the writes still going out, and the account of the run
   * is set when it ends.
   */
  const running = changing !== null || undoing !== null;

  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  );

  /**
   * "Food : Groceries" where the group adds something, the bare name where it
   * does not — the payee sweep's convention, so a category reads the same
   * wherever it is offered. A filing pointing at nothing says so: it is a real
   * state of real data, and the row it is on is exactly the one to re-file.
   */
  const categoryLabel = useMemo(() => (id: string): string => {
    const category = categoriesById.get(id);
    if (!category) return 'a category that no longer exists';
    const parent = category.parentId ? categoriesById.get(category.parentId) : undefined;
    return parent && parent.level !== 'type' ? `${parent.name} : ${category.name}` : category.name;
  }, [categoriesById]);

  /**
   * A filing the picker has no name for, because the category is gone.
   *
   * The house control names any category that EXISTS, offered or not, so the
   * trigger tells the truth about a revaluation leaf, an account's To/From, or
   * a group. A dangling id is the one case it cannot draw — and drawing nothing
   * would read as "no category", which is the opposite of this row's problem.
   *
   * The FILTER of the same name matches on this exact predicate (it is handed
   * down to rowMatches), so a row the list found can never draw itself as
   * anything else — and it is the SHARED one, the same rule the data-health
   * count is measured with (utils/categoryHealth), so the number that sends a
   * reader here and the rows they arrive at cannot be answering different
   * questions. Memoised on the tree because the search memos below depend on it.
   */
  const filingHasNoName = useCallback(
    (categoryId: string): boolean => isDanglingFiling(categoryId, categoriesById),
    [categoriesById]
  );

  /** The rows this mount owns — see the note on the prop. */
  const searchable = useMemo(() => transactions.filter(population), [transactions, population]);

  const activeFilters = useMemo(() => filters.filter(filterHasValue), [filters]);

  /**
   * Is the reader looking at the rows whose category is gone?
   *
   * Asked of the ACTIVE FILTERS rather than of the preset, so choosing that kind
   * from the selector by hand is answered exactly as arriving on the panel's
   * action is: the split lines are missing from the results either way, and what
   * makes the sentence true is the search, not how the page was opened.
   */
  const searchingForDangling = useMemo(
    () => activeFilters.some(filter => filter.kind === 'dangling'),
    [activeFilters]
  );

  const matched = useMemo(() => {
    if (activeFilters.length === 0) return [];
    return searchable
      .filter(transaction => activeFilters.every(
        filter => rowMatches(transaction, filter, filingHasNoName)
      ))
      // Newest first, the register's own order: the rows somebody is looking
      // for are far likelier to be recent than to be at the start of a decade.
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchable, activeFilters, filingHasNoName]);

  /**
   * Transfers the same filters caught. Counted, never listed — and said out
   * loud, because a shortfall between "everything called Tesco" and what is on
   * screen is exactly the kind of gap that reads as lost money.
   */
  const transferMatches = useMemo(() => {
    if (activeFilters.length === 0) return 0;
    return transactions.filter(
      transaction => transaction.type === 'transfer'
        && activeFilters.every(filter => rowMatches(transaction, filter, filingHasNoName))
    ).length;
  }, [transactions, activeFilters, filingHasNoName]);

  /**
   * The accounts the population sits in — and only those, because an account
   * with nothing searchable in it is an answer of zero dressed as a choice.
   *
   * Named the way the rows below name them (closed ones marked as such), and
   * carrying the three facts the picker bands by, so its sections are the
   * Accounts page's sections in the Accounts page's order. An id with no
   * account behind it keeps its name and lands under "Other Accounts", which is
   * what that catch-all is for; it is not dropped, because it has rows.
   */
  const accountsInUse = useMemo<SelectableAccount[]>(() => {
    const byId = new Map(historicalAccounts.map(account => [account.id, account]));
    const ids = new Set(searchable.map(transaction => transaction.accountId));
    return [...ids].map(id => {
      const account = byId.get(id);
      return {
        id,
        name: accountName(id),
        type: account?.type ?? 'other',
        institution: account?.institution,
        parentAccountId: account?.parentAccountId,
      };
    });
  }, [searchable, historicalAccounts, accountName]);

  /** Every tag on the population, so the picker can only offer real ones. */
  const tagsInUse = useMemo(() => {
    const tags = new Set<string>();
    for (const transaction of searchable) {
      for (const tag of transaction.tags ?? []) tags.add(tag);
    }
    return [...tags].sort((a, b) => compareNames(a, b));
  }, [searchable]);

  const visible = matched.slice(0, DISPLAY_CAP);
  // Memoised because a bulk run re-renders this component once per write, and
  // the match it walks is not the drawn two hundred — it is every row the
  // filters caught, which on a long history is thousands.
  const selectedRows = useMemo(
    () => matched.filter(transaction => selectedIds.has(transaction.id)),
    [matched, selectedIds]
  );
  const allSelected = matched.length > 0 && selectedRows.length === matched.length;

  /**
   * A new question, so everything answering the old one goes: the ticks, the
   * unsaved picks, the account of the last press — and the one shot back,
   * which is about rows that may not even be in the new results.
   */
  const changeFilters = useCallback((next: Filter[]): void => {
    setFilters(next);
    setSelectedIds(new Set());
    setRowChoices({});
    setSummary(null);
    setUndoable([]);
    setUndoneCount(null);
  }, []);

  /**
   * A search asked for from OUTSIDE — the data-health panel's re-file action,
   * or the link that arrives on that page from Categorisation carrying the
   * same request.
   *
   * Applied ONCE PER TOKEN, so a reader who narrows the search afterwards
   * keeps their own filters and a second press puts the asked-for search back.
   * The token is what guards that, never the effect's dependencies: a parent
   * that builds a fresh `{ kind, token }` object on each render is an ordinary
   * thing to write, and it must not cost the reader their search.
   */
  const presetKind = preset?.kind ?? null;
  const presetToken = preset?.token ?? null;
  const presetApplied = useRef<number | null>(null);
  useEffect((): void => {
    if (presetKind === null || presetToken === null) return;
    if (presetApplied.current === presetToken) return;
    presetApplied.current = presetToken;
    changeFilters([newFilter(presetKind)]);
  }, [presetKind, presetToken, changeFilters]);

  const updateFilter = (id: string, changes: Partial<Filter>): void => {
    changeFilters(filters.map(filter => (filter.id === id ? { ...filter, ...changes } : filter)));
  };

  /**
   * Take a filter row away — or, when it is the last one, empty it. The panel
   * always offers somewhere to start; a section with no boxes in it looks
   * broken rather than finished.
   */
  const removeFilter = (id: string): void => {
    changeFilters(filters.length === 1 ? [newFilter()] : filters.filter(filter => filter.id !== id));
  };

  const toggleSelected = (id: string): void => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * All means ALL — every row the filters matched, not the two hundred drawn.
   * That is the whole point of it: the press exists for the search too long to
   * work through by hand.
   */
  const toggleSelectAll = (): void => {
    setSelectedIds(allSelected ? new Set() : new Set(matched.map(transaction => transaction.id)));
  };

  /** The three fields a filing is, and the only three any press here writes. */
  const filedUnder = (categoryId: string): Partial<Transaction> => ({
    category: categoryId,
    categoryConfirmed: true,
    needsReview: false,
  });

  const chosenFor = (transaction: Transaction): string =>
    rowChoices[transaction.id] ?? transaction.category;

  /** Is there a decision on this row for the Save button to write? */
  const rowIsSaveable = (transaction: Transaction): boolean => {
    const chosen = chosenFor(transaction);
    if (chosen === '') return false;
    return chosen !== transaction.category || copy.filesUnchangedRows === true;
  };

  const saveRow = async (transaction: Transaction): Promise<void> => {
    const categoryId = chosenFor(transaction);
    if (!rowIsSaveable(transaction)) return;
    setSavingRowId(transaction.id);
    try {
      await updateTransaction(transaction.id, filedUnder(categoryId));
      setRowChoices(previous => {
        const next = { ...previous };
        delete next[transaction.id];
        return next;
      });
      showSuccess(`Filed under ${categoryLabel(categoryId)}.`, copy.savedTitle);
    } catch (error) {
      showError(error);
    } finally {
      setSavingRowId(null);
    }
  };

  /**
   * The bulk press, one write at a time with the count on screen.
   *
   * Sequential rather than fanned out: these are hundreds of writes against
   * one ledger, the progress has to be true while it runs, and a failure has
   * to be attributable to a row rather than to a batch.
   *
   * Each row's previous filing is read off the snapshot the press was made
   * against, and recorded only once that row's write has landed — so the undo
   * can never offer to put back something that never moved.
   */
  const runBulkChange = async (): Promise<void> => {
    const rows = selectedRows;
    const categoryId = bulkCategory;
    setConfirming(false);
    if (rows.length === 0 || categoryId === '') return;
    setSummary(null);
    setUndoneCount(null);
    setChanging({ done: 0, total: rows.length });
    const previous: PreviousFiling[] = [];
    let failed = 0;
    for (const [index, transaction] of rows.entries()) {
      try {
        await updateTransaction(transaction.id, filedUnder(categoryId));
        previous.push({
          id: transaction.id,
          category: transaction.category,
          categoryConfirmed: transaction.categoryConfirmed,
          needsReview: transaction.needsReview,
        });
      } catch {
        failed += 1;
      }
      setChanging({ done: index + 1, total: rows.length });
    }
    setChanging(null);
    setSelectedIds(new Set());
    setUndoable(previous);
    setSummary({ changed: previous.length, failed, categoryId });
  };

  /**
   * Put the changed rows back exactly as they were — the category and both
   * flags, including the flags' absence, which is itself a state a row can be
   * in. One shot: once used, or once the search changes, it is gone.
   */
  const runUndo = async (): Promise<void> => {
    const rows = undoable;
    if (rows.length === 0) return;
    setUndoing({ done: 0, total: rows.length });
    let restored = 0;
    let failed = 0;
    for (const [index, filing] of rows.entries()) {
      try {
        await updateTransaction(filing.id, {
          category: filing.category,
          categoryConfirmed: filing.categoryConfirmed,
          needsReview: filing.needsReview,
        });
        restored += 1;
      } catch {
        failed += 1;
      }
      setUndoing({ done: index + 1, total: rows.length });
    }
    setUndoing(null);
    setUndoable([]);
    setSummary(null);
    setUndoneCount(restored);
    if (failed > 0) {
      showError(new Error(
        `${formatCount(failed)} of those could not be put back and keep the category this press gave them.`
      ));
    }
  };

  /**
   * The app's category picker — the same control, and the same type-to-find, as
   * editing a transaction.
   *
   * `includeAllTypes` is what carries the mixed-directions ruling above: both
   * directions in every one of these, whatever the row is. It also means
   * `transactionType` decides nothing here — the only other thing that reads it
   * is the create form, which `allowCreate={false}` never shows. New categories
   * are made in the tree on Settings → Categories, which is where the other
   * mount of this list sits.
   */
  const categoryPicker = (
    value: string,
    onChange: (id: string) => void,
    ariaLabel: string,
    shape: {
      className?: string;
      size?: 'default' | 'row';
      usePortal?: boolean;
      allowGroupSelection?: boolean;
    } = {}
  ): React.JSX.Element => (
    <CategorySelector
      selectedCategory={value}
      onCategoryChange={onChange}
      transactionType="expense"
      includeAllTypes
      allowCreate={false}
      showHelperText={false}
      placeholder="Choose a category…"
      ariaLabel={ariaLabel}
      className={shape.className}
      size={shape.size}
      usePortal={shape.usePortal}
      allowGroupSelection={shape.allowGroupSelection}
    />
  );

  /*
   * THE PLAIN FIELDS WEAR THE HOUSE PICKER'S BOX, because they stand beside it.
   * 42px and a rounded-xl on a desktop is what a combobox trigger is; a 30px
   * rounded-lg field next to one reads as a different kind of control asking a
   * different kind of question. The 44px floor below `sm` is the touch target
   * and is unchanged.
   */
  const fieldClass =
    'min-h-[44px] sm:min-h-[42px] px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50';

  // The calendar field brings its own padding (`size` defaults to md, which is
  // the same px-3 py-2), so this is the rest of the box and nothing else.
  const dateFieldClass =
    'min-h-[44px] sm:min-h-[42px] text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

  /**
   * The boxes a kind asks for, or null where it asks for none — which is the
   * whole of the dangling filter's interface (see the note at the top). Null
   * means the row draws no second line at all rather than an empty one: there
   * is nothing to indent under the kind that governs it.
   */
  const renderFilterInputs = (filter: Filter, position: number): React.JSX.Element | null => {
    switch (filter.kind) {
      case 'text':
        return (
          <input
            type="text"
            value={filter.text}
            onChange={event => updateFilter(filter.id, { text: event.target.value })}
            placeholder="Any words in the description or notes"
            aria-label={`Words to look for, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          />
        );
      case 'category':
        // Groups offered as well as leaves — see the note at the top of the
        // file: a group with thousands of rows filed straight on it is exactly
        // the search this tool exists for.
        return categoryPicker(
          filter.categoryId,
          categoryId => updateFilter(filter.id, { categoryId }),
          `Current category, filter ${position}`,
          { className: 'flex-1 min-w-[12rem]', allowGroupSelection: true }
        );
      case 'account':
        return (
          <div className="flex-1 min-w-[12rem]">
            <AccountSelector
              accounts={accountsInUse}
              selectedAccountId={filter.accountId}
              onAccountChange={accountId => updateFilter(filter.id, { accountId })}
              placeholder="Choose an account…"
              ariaLabel={`Account, filter ${position}`}
            />
          </div>
        );
      case 'date':
        // A range is two of the app's own calendar, because the app has no
        // range control and two ends IS what a range is here. Wide enough for
        // dd/mm/yyyy and the glyph beside it, so neither ever ellipsises.
        return (
          <>
            <div className="w-40">
              <DatePicker
                value={filter.from}
                onChange={from => updateFilter(filter.id, { from })}
                aria-label={`From date, filter ${position}`}
                className={dateFieldClass}
              />
            </div>
            <div className="w-40">
              <DatePicker
                value={filter.to}
                onChange={to => updateFilter(filter.id, { to })}
                aria-label={`To date, filter ${position}`}
                className={dateFieldClass}
              />
            </div>
          </>
        );
      case 'amount':
        return (
          <>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filter.min}
              onChange={event => updateFilter(filter.id, { min: event.target.value })}
              placeholder="Smallest"
              aria-label={`Smallest amount, ignoring whether it went in or out, filter ${position}`}
              disabled={running}
              className={`${fieldClass} w-28`}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filter.max}
              onChange={event => updateFilter(filter.id, { max: event.target.value })}
              placeholder="Largest"
              aria-label={`Largest amount, ignoring whether it went in or out, filter ${position}`}
              disabled={running}
              className={`${fieldClass} w-28`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              size only — 12.99 finds money in and money out alike
            </span>
          </>
        );
      case 'tag':
        return (
          <select
            value={filter.tag}
            onChange={event => updateFilter(filter.id, { tag: event.target.value })}
            aria-label={`Tag, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          >
            <option value="">Choose a tag…</option>
            {tagsInUse.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        );
      case 'dangling':
        return null;
    }
  };

  return (
    <>
      {open && (
        <div className={className}>
          {header}

          <div className="mt-4 space-y-2">
            {filters.map((filter, index) => {
              const inputs = renderFilterInputs(filter, index + 1);
              return (
                // A grid below `sm` and the flex row it always was above it.
                // The cells are placed by explicit coordinates rather than by
                // source order — the same reflow the results table below uses —
                // so the ✕ can sit beside the kind selector on the top line
                // while the markup keeps the reading order the desktop wants.
                <div
                  key={filter.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:items-center"
                >
                  <select
                    value={filter.kind}
                    onChange={event => {
                      const kind = event.target.value;
                      if (isFilterKind(kind)) updateFilter(filter.id, { kind });
                    }}
                    aria-label={`What to filter by, filter ${index + 1}`}
                    disabled={running}
                    // `min-w-0` only while it is a grid cell: a select's own
                    // minimum is the width of its longest option, which would
                    // burst a phone-width track. `min-w-[auto]` hands that
                    // minimum back at `sm`, where the row is flex and the
                    // select has always sized itself to its text.
                    className={`${fieldClass} col-start-1 row-start-1 min-w-0 sm:min-w-[auto]`}
                  >
                    {(Object.keys(FILTER_KIND_LABELS) as FilterKind[]).map(kind => (
                      <option key={kind} value={kind}>{FILTER_KIND_LABELS[kind]}</option>
                    ))}
                  </select>
                  {/* The value box, or boxes, on their own line under the kind
                      that governs them and indented to say so (owner, 1 Sep
                      2026). `sm:contents` dissolves this wrapper at every width
                      the desktop uses, so the inputs go back to being flex
                      items of the row itself and nothing above `sm` changes.
                      A kind that asks for nothing gets no line at all — there
                      is nothing to stack. */}
                  {inputs !== null && (
                    <div className="col-span-2 row-start-2 min-w-0 pl-4 flex flex-wrap items-center gap-2 sm:contents">
                      {inputs}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFilter(filter.id)}
                    disabled={running}
                    aria-label={`Remove filter ${index + 1}`}
                    title="Remove this filter"
                    className="col-start-2 row-start-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => changeFilters([...filters, newFilter()])}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <PlusIcon size={14} />
              Add a filter
            </button>
          </div>

          {/* ─ WHAT THE PRESS IS DOING, AND WHAT IT DID ────────────────────
              Outside the results below, and that placement is the whole
              point of it: a press that files two hundred rows under a new
              category takes every one of them OUT of the search that found
              them, so the list empties as the run lands. Inside the results
              this account of the run — and the Undo with it — would vanish
              at the exact moment it became the only thing on screen worth
              reading. */}
          {changing !== null && (
            <p role="status" className="mt-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              {copy.bulkGerund} {formatCount(changing.done)} of {formatCount(changing.total)}…
            </p>
          )}
          {undoing !== null && (
            <p role="status" className="mt-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Putting back {formatCount(undoing.done)} of {formatCount(undoing.total)}…
            </p>
          )}
          {summary !== null && (
            <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">
              {summary.changed > 0 && (
                <>
                  <strong>{formatCount(summary.changed)}</strong> transaction
                  {summary.changed === 1 ? ' is' : 's are'} now filed under{' '}
                  {categoryLabel(summary.categoryId)}.{' '}
                </>
              )}
              {summary.failed > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {copy.bulkFailed(summary.failed)}{' '}
                </span>
              )}
              {undoable.length > 0 && (
                <button
                  type="button"
                  onClick={() => void runUndo()}
                  disabled={running}
                  className="underline underline-offset-2 font-medium text-gray-900 dark:text-white disabled:opacity-50"
                >
                  Undo
                </button>
              )}
            </p>
          )}
          {undoneCount !== null && (
            <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">
              {copy.undone(undoneCount)}
            </p>
          )}

          {activeFilters.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Fill in a filter and the transactions it matches are listed here. Nothing is
              searched until you ask something.
            </p>
          ) : matched.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {copy.nothingMatched(activeFilters.length)}
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px] sm:min-h-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={running}
                    aria-label={allSelected
                      ? 'Unselect all matched transactions'
                      : `Select all ${formatCount(matched.length)} matched transactions`}
                  />
                  {allSelected ? 'Unselect all' : `Select all ${formatCount(matched.length)}`}
                </label>
                {selectedRows.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                      {formatCount(selectedRows.length)} selected
                    </span>
                    <div className="w-full sm:w-64">
                      {categoryPicker(
                        bulkCategory,
                        setBulkCategory,
                        'Category to file the selected transactions under'
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      disabled={running || bulkCategory === ''}
                      className="px-4 py-2 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copy.bulkVerb} {formatCount(selectedRows.length)} transaction{selectedRows.length === 1 ? '' : 's'}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-3 overflow-x-auto">
                {/* A table on a desktop, a card per row on a phone — the house
                    reflow (see DuplicateSweepModal). Source order IS the
                    desktop column order, so below `sm` each cell is placed by
                    explicit grid coordinates instead. */}
                <table className="block sm:table w-full">
                  <thead className="hidden sm:table-header-group">
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 w-8" aria-label="Select" />
                      <th className="text-left pb-2 font-medium">Date</th>
                      <th className="text-left pb-2 font-medium">Description</th>
                      <th className="text-left pb-2 font-medium">Account</th>
                      <th className="text-right pb-2 font-medium">Amount</th>
                      <th className="text-left pb-2 font-medium w-56">Category</th>
                      <th className="pb-2 w-20" />
                    </tr>
                  </thead>
                  <tbody className="block sm:table-row-group">
                    {visible.map(transaction => {
                      const chosen = chosenFor(transaction);
                      const saveable = rowIsSaveable(transaction);
                      const when = shortDate(transaction.date);
                      return (
                        <tr
                          key={transaction.id}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 py-2 sm:py-0 sm:table-row border-b border-gray-50 dark:border-gray-700/50 align-top"
                        >
                          <td className="block sm:table-cell col-start-1 row-start-1 sm:py-2 sm:pr-1 sm:align-top">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(transaction.id)}
                              onChange={() => toggleSelected(transaction.id)}
                              disabled={running}
                              aria-label={`Select ${transaction.description} on ${when}`}
                              className="mt-0.5"
                            />
                          </td>
                          <td className="block sm:table-cell col-start-2 row-start-2 sm:py-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {when}
                          </td>
                          <td className="block sm:table-cell col-start-2 row-start-1 min-w-0 sm:py-2 text-sm text-gray-900 dark:text-white">
                            <span className="block truncate sm:max-w-[18rem]">
                              {transaction.description}
                            </span>
                          </td>
                          <td className="block sm:table-cell col-start-3 row-start-2 min-w-0 sm:py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            <span className="block truncate sm:max-w-[10rem] text-right sm:text-left">
                              {accountName(transaction.accountId)}
                            </span>
                          </td>
                          {/* Sign as well as hue — the house amount idiom. A
                              mixed selection has to be legible to eyes that
                              cannot tell the two colours apart, and to a
                              screen reader saying the row aloud. */}
                          <td className={`block sm:table-cell col-start-3 row-start-1 sm:py-2 text-sm font-medium text-right tabular-nums whitespace-nowrap ${
                            transaction.amount < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {transaction.amount < 0 ? '−' : '+'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </td>
                          {/* The register's own cell-sized picker, portaled:
                              the results sit in an `overflow-x-auto` scroller,
                              which clips an in-flow list to the width of the
                              column it drops out of. */}
                          <td className="block sm:table-cell col-span-2 col-start-2 row-start-3 mt-1 sm:mt-0 sm:py-2 sm:pr-2">
                            {categoryPicker(
                              chosen,
                              value => setRowChoices(previous => ({ ...previous, [transaction.id]: value })),
                              `Category for ${transaction.description} on ${when}`,
                              { size: 'row', usePortal: true }
                            )}
                            {/* Said in words because the picker cannot say it:
                                the consequence, then the remedy. */}
                            {filingHasNoName(chosen) && (
                              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                                Filed under a category that no longer exists — choose one to put it right.
                              </span>
                            )}
                          </td>
                          <td className="block sm:table-cell col-span-3 col-start-1 row-start-4 mt-1 sm:mt-0 sm:py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void saveRow(transaction)}
                              disabled={!saveable || running || savingRowId === transaction.id}
                              aria-label={`Save the category for ${transaction.description} on ${when}`}
                              className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingRowId === transaction.id ? 'Saving…' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {matched.length > DISPLAY_CAP && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Showing the first {formatCount(DISPLAY_CAP)} of {formatCount(matched.length)} matched —
                  narrow the search, or use the bulk change (it covers all{' '}
                  {formatCount(matched.length)} matched when everything is ticked).
                </p>
              )}

              {/* A zero renders nothing (house rule); a shortfall the user can
                  count for themselves does not. */}
              {transferMatches > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {copy.transfersExcluded(transferMatches)}
                </p>
              )}
            </>
          )}

          {/* THE OTHER HALF OF THE PANEL'S COUNT (owner, 1 Sep 2026).
              Sibling of the transfers note above and dressed as one, but
              OUTSIDE the results: when every dangling row is a split line this
              list matches nothing at all, and "no transaction matches that
              filter" under a panel promising three is precisely the moment the
              sentence has to be on screen. The count comes from the same
              measure the panel's does, so the reader can do the subtraction and
              have it come out. A zero says nothing, as ever. */}
          {searchingForDangling && danglingSplitLines > 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {formatCount(danglingSplitLines)} of these{' '}
              {danglingSplitLines === 1
                ? 'is inside a split — edit that split to re-file it.'
                : 'are inside splits — edit those splits to re-file them.'}
            </p>
          )}

          {copy.footnote !== undefined && (
            <p className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {copy.footnote}
            </p>
          )}
        </div>
      )}

      {/* The consequence before the press, in its own numbers — the part a
          count alone cannot say, and the part that differs between a first
          filing and a re-filing, which is why the mount supplies the sentence
          and the mechanism supplies the numbers. */}
      {confirming && (
        <Modal
          isOpen
          onClose={() => setConfirming(false)}
          title={`${copy.bulkVerb} ${formatCount(selectedRows.length)} transaction${selectedRows.length === 1 ? '' : 's'}?`}
          size="md"
        >
          <ModalBody>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {copy.bulkConsequence(selectedRows.length, categoryLabel(bulkCategory))}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <AlertTriangleIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Nothing is deleted and no balance moves. You can put them all back straight
                afterwards, until the next search.
              </span>
            </p>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runBulkChange()}
                className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors"
              >
                {copy.bulkVerb} them
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
