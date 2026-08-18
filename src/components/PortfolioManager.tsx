import { useEffect, useRef, useState } from 'react';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, parseMoneyInput, type DecimalInstance } from '../utils/decimal';
import { useFxQuote } from '../hooks/useFxQuote';
import {
  AMOUNT_DP,
  RATE_DP,
  destinationForRate,
  rateToDisplayString,
  sourceForRate,
  type FxRateSource,
} from '../utils/fx';
import { formatDecimal } from '../utils/decimal-format';
import { supportedCurrencies } from '../utils/currency';
import MoneyInput from './common/MoneyInput';
import DatePicker from './common/DatePicker';
import StockSymbolSearch from './StockSymbolSearch';
import { fetchQuotes, type StockQuote } from '../services/stockPriceService';
import { PlusIcon, EditIcon, DeleteIcon, CheckIcon } from './icons';
import { Modal } from './common/Modal';
import { LoadingButton } from './loading/LoadingState';
// From the LIFTED module, not from `services/api/investmentService` — which
// re-exports all three and whose first line builds a Supabase client. This is a
// RUNTIME import (`INVESTMENT_ASSET_TYPES` is a value), so the old path put the
// cloud in a desktop bundle through a dropdown's list of asset kinds. Measured:
// it was one of the two chains left keeping the Investments route out of a
// window after the page itself went through the seam.
import {
  INVESTMENT_ASSET_TYPES,
  type InvestmentAssetType,
  type InvestmentHolding
} from '../services/investments/holding';
import { purchaseCashTotal } from '../services/investments/purchaseMath';
import type { Account } from '../types';

/**
 * Add, change and remove holdings — and actually keep them.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────────
 * This component used to hand a whole new array to `onUpdate`, which the page
 * passed to `updateAccount({ holdings })`. `holdings` is not a column of
 * `accounts` and api/accountMapping.ts strips it from every write, so the call
 * succeeded and stored nothing: every holding anyone ever entered was gone on
 * reload. Each action is now its own persisted operation against
 * public.investments, and each one reports its own failure.
 *
 * ── AND THE SYMBOL FIELD ────────────────────────────────────────────────────
 * The old form took free text and validated it with `validateSymbol`, which
 * asked Yahoo for a quote from the browser — a request the CSP blocks and Yahoo
 * would not answer anyway. It therefore rejected EVERY symbol, including AAPL,
 * with "not found". The field is now a lookup: you pick a real instrument, so
 * there is nothing left to validate.
 *
 * ── THE CURRENCY IS THE INSTRUMENT'S, NOT THE ACCOUNT'S (owner, 17 Aug) ─────
 * "Average cost per unit (GBP)" was a claim, not a question: Apple trades in
 * dollars whatever currency the account counts in, and a dollar figure filed
 * as pounds is wrong by the exchange rate forever after. Picking a symbol now
 * fetches its QUOTE — the one source that states the trading currency
 * authoritatively (LSE pence already normalised to pounds at the proxy) — and
 * the price it brings back is shown, so the owner can sanity-check the figure
 * they are about to type. No quote (a fund with no price today, the provider
 * rate-limiting) degrades to a sensible default and an editable dropdown,
 * never a blocked form.
 *
 * ── THE PURCHASE IS ALSO CASH LEAVING SOMEWHERE (owner, 17 Aug) ─────────────
 * Money's model, measured from real .mny files: a buy could name any funding
 * account (2015 of 2029 buys carried a cash leg), commission folded into the
 * total, and the cash leg moved that total. So the add form offers the same:
 * charges (stamp duty, a levy, commission) that fold into the all-in average
 * cost, and an optional "paid from" account that writes the transfer — out of
 * the chosen account, into this investment account — through the same
 * machinery every other transfer uses. The page owns those writes; this form
 * only gathers the answers.
 */

/** What a save needs, independent of whether it is an add or an edit. */
export interface HoldingFormValues {
  symbol: string;
  name: string;
  quantity: DecimalInstance;
  averageCost: DecimalInstance;
  /** The currency the cost figures are IN — the instrument's, not the account's. */
  currency: string;
  assetType: InvestmentAssetType;
}

/** The cash half of an add: charges, and where the money came from. */
export interface PurchaseDetails {
  /** In the holding's currency; folds into the all-in average cost. Zero when none. */
  charges: DecimalInstance;
  /** null: just record the holding, no transfer. */
  fundingAccountId: string | null;
  /** What actually left the funding account, in ITS currency. null without funding. */
  totalPaid: DecimalInstance | null;
  /** The trade date — the transfer's date and the holding's purchase date. */
  date: Date;
  /**
   * The conversion this buy was struck at, when the instrument's currency and
   * the funding account's differ. null when they agree — there is nothing to
   * account for.
   *
   * Carried so the figure can be ACCOUNTED FOR later: a total that is 250 USD
   * at one rate and 250 USD at another are different amounts of sterling, and
   * a register that records only the sterling cannot say which happened.
   */
  fx: {
    rate: DecimalInstance;
    /** From the instrument's currency… */
    from: string;
    /** …into the funding account's. */
    to: string;
    /** Whose figure it is: the provider's, or the owner's. */
    source: FxRateSource;
    /** When the rate was true. */
    asOf: Date;
  } | null;
}

interface PortfolioManagerProps {
  holdings: readonly InvestmentHolding[];
  /** The investment account's currency — the fallback when a holding has none. */
  currency: string;
  /**
   * Accounts a purchase may be funded from: open, not this account, and in
   * THIS ACCOUNT'S currency — the counterpart write mints the far side from
   * the same digits, so a cross-currency funding needs the transfer dialog's
   * confirmed-figure flow, not a silent copy. The page filters; this renders.
   */
  fundingAccounts: readonly Account[];
  onAdd: (values: HoldingFormValues, purchase: PurchaseDetails) => Promise<void>;
  onEdit: (id: string, values: HoldingFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /**
   * Ask this manager to open its add form from OUTSIDE — the page's own
   * "Add a holding" door, which now leads here rather than to a second modal
   * that wrote a transaction and no holding.
   *
   * A signal rather than a controlled `isAddOpen`: the page is saying "open
   * it", once, and everything after that (validating, saving, closing) belongs
   * to this component. A boolean the page owned would make the page responsible
   * for clearing it on cancel, and a page that forgot would jam the form open.
   * Any CHANGE to this value opens the form, so a second press re-opens it.
   *
   * It fires on MOUNT too, which is the usual case rather than the exception:
   * this manager is collapsed until the page expands it, so the press that
   * opens the form is the same press that brings this component into being.
   */
  openAddSignal?: number;
  /**
   * Fired once the signal above has been acted on, so the page can drop it.
   *
   * Without this the signal outlives its press: expanding the same account
   * again later would remount this component with the old value still set and
   * spring the form open at nobody's request.
   */
  onAddSignalHandled?: () => void;
}

const ASSET_TYPE_LABELS: Readonly<Record<InvestmentAssetType, string>> = {
  stock: 'Share',
  bond: 'Bond',
  etf: 'ETF',
  mutual_fund: 'Fund',
  crypto: 'Crypto',
  commodity: 'Commodity',
  real_estate: 'Property',
  other: 'Other'
};

/** Yahoo's own type words, mapped to the asset types the table admits. */
function assetTypeFromLookup(type: string): InvestmentAssetType {
  const normalised = type.toLowerCase();
  if (normalised.includes('etf')) return 'etf';
  if (normalised.includes('fund')) return 'mutual_fund';
  if (normalised.includes('crypto')) return 'crypto';
  if (normalised.includes('bond')) return 'bond';
  if (normalised.includes('equity') || normalised.includes('stock')) return 'stock';
  return 'other';
}

/**
 * The currency to OFFER before (or without) a quote: LSE listings price in
 * pounds once the proxy has normalised the pence, a bare symbol is Yahoo's US
 * dialect, anything else falls back to the account. A guess, deliberately
 * displayed in an editable dropdown — the quote corrects it when one arrives,
 * and the owner corrects it when one does not.
 */
function defaultCurrencyFor(symbol: string, exchange: string, fallback: string): string {
  if (exchange === 'LSE' || symbol.toUpperCase().endsWith('.L')) return 'GBP';
  if (!symbol.includes('.')) return 'USD';
  return fallback;
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white';

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const helperClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

/**
 * A typed rate, or null while it is not yet a positive number.
 *
 * Deliberately NOT `parseMoneyInput`: a rate is a ratio, not money, and it
 * carries far more places than pennies (see utils/fx — RATE_DP is ten). A
 * half-typed box is a normal state, not an error, so this returns null rather
 * than complaining.
 */
function readPositiveRate(text: string): DecimalInstance | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  try {
    const value = toDecimal(trimmed);
    if (!value.isFinite() || value.isNaN() || value.lessThanOrEqualTo(0)) return null;
    return value.toDecimalPlaces(RATE_DP);
  } catch {
    return null;
  }
}

const toDateInputValue = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export default function PortfolioManager({
  holdings,
  currency,
  fundingAccounts,
  onAdd,
  onEdit,
  onDelete,
  openAddSignal,
  onAddSignalHandled
}: PortfolioManagerProps): React.JSX.Element {
  const { formatCurrency, convert, convertAndSum, displayCurrency } = useCurrencyDecimal();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentHolding | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<InvestmentAssetType>('stock');
  const [pickingSymbol, setPickingSymbol] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [averageCost, setAverageCost] = useState('');
  const [holdingCurrency, setHoldingCurrency] = useState(currency);
  // Once the owner has picked a currency by hand, a quote arriving later must
  // not overrule them — they may know something the feed does not.
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [charges, setCharges] = useState('');
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [totalPaid, setTotalPaid] = useState('');
  const [totalPaidTouched, setTotalPaidTouched] = useState(false);
  /**
   * The rate this ONE purchase was struck at, when the instrument prices in a
   * currency the funding account does not count in.
   *
   * Owner, 18 Aug: "a currency conversion rate box that defaults to the most
   * up to date figure we have in the system but if the user got a different
   * rate (which they likely did), they can input their own rate for this
   * transaction and we just convert in to the GBP boxes." The default matters
   * less than the override: a broker's rate includes a spread, so the
   * mid-market quote is a starting point, never the answer.
   */
  const [rateText, setRateText] = useState('');
  const [rateTouched, setRateTouched] = useState(false);
  /**
   * Which currency the COST FIGURES are being typed in, when the instrument
   * prices in one the account does not count in.
   *
   * The other half of the owner's 18 Aug ask: "enter the price and fees
   * either in his base currency … or … in the investment local currency".
   * The HOLDING is stored in the instrument's currency whichever is chosen —
   * its quotes arrive in that currency, and a gain measured across two
   * currencies is not a gain — so figures typed in the account's money are
   * converted INTO the instrument's at the rate box, and the conversion is
   * said out loud in the provenance.
   */
  const [entryCurrency, setEntryCurrency] = useState<'instrument' | 'account'>('instrument');
  const [purchaseDate, setPurchaseDate] = useState(() => toDateInputValue(new Date()));

  // The picked instrument's live quote: the trading currency stated by the
  // exchange, and a price to sanity-check the typed cost against.
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const resetForm = (): void => {
    setSymbol('');
    setName('');
    setAssetType('stock');
    setPickingSymbol(true);
    setQuantity('');
    setAverageCost('');
    setHoldingCurrency(currency);
    setCurrencyTouched(false);
    setCharges('');
    setFundingAccountId('');
    setTotalPaid('');
    setTotalPaidTouched(false);
    setRateText('');
    setRateTouched(false);
    setEntryCurrency('instrument');
    setPurchaseDate(toDateInputValue(new Date()));
    setQuote(null);
    setQuoteLoading(false);
    setFormError('');
  };

  const closeModal = (): void => {
    setIsAddOpen(false);
    setEditing(null);
    resetForm();
  };

  const startAdd = (): void => {
    resetForm();
    setIsAddOpen(true);
  };

  /**
   * The page's door, honoured — including on the mount the press caused.
   *
   * Keyed on a CHANGE of the value, so pressing the page's button again after
   * a cancel re-opens the form. The ref starts UNSET rather than seeded with
   * the incoming value: this component is collapsed until the page expands it,
   * so the first render usually IS the press, and seeding would swallow it.
   * The page is told the signal has been used, and drops it, which is what
   * stops the same value re-firing on a later mount.
   */
  const lastAddSignal = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (openAddSignal === undefined || openAddSignal === lastAddSignal.current) return;
    lastAddSignal.current = openAddSignal;
    startAdd();
    onAddSignalHandled?.();
    // startAdd is a stable local closure over setState calls only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddSignal, onAddSignalHandled]);

  const startEdit = (holding: InvestmentHolding): void => {
    setFormError('');
    setSymbol(holding.symbol);
    setName(holding.name);
    setAssetType(holding.assetType);
    setPickingSymbol(false);
    setQuantity(holding.quantity.toString());
    setAverageCost(holding.averageCost.toString());
    setHoldingCurrency(holding.currency || currency);
    setCurrencyTouched(true);
    setQuote(null);
    setEditing(holding);
  };

  /** Ask the exchange what this instrument trades in, and at. */
  const loadQuote = (picked: string): void => {
    setQuote(null);
    setQuoteLoading(true);
    void fetchQuotes([picked])
      .then((batch) => {
        const found = batch.quotes.get(picked.toUpperCase());
        if (found) {
          setQuote(found);
          setCurrencyTouched((touched) => {
            if (!touched) setHoldingCurrency(found.currency);
            return touched;
          });
        }
      })
      .catch(() => {
        // No quote is not an error the form needs to announce: the currency
        // dropdown already holds a sensible default and stays editable.
      })
      .finally(() => setQuoteLoading(false));
  };

  const handleDelete = async (holding: InvestmentHolding): Promise<void> => {
    if (!confirm(`Remove ${holding.symbol} from this account's holdings?`)) return;
    setListError('');
    setDeletingId(holding.id);
    try {
      await onDelete(holding.id);
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : `Could not remove ${holding.symbol}.`
      );
    } finally {
      setDeletingId(null);
    }
  };

  const fundingAccount = fundingAccounts.find((a) => a.id === fundingAccountId) ?? null;
  const chargesValue = charges === '' ? 0 : parseMoneyInput(charges);
  const quantityValue = Number(quantity);
  const costValue = parseMoneyInput(averageCost);

  /**
   * What the purchase costs in cash, in the HOLDING's currency — the default
   * for "total paid" whenever the funding account counts in that currency.
   * Across a currency boundary there is no default: the true figure is on the
   * broker's note, and inventing one via an FX rate would write an unverified
   * number into two registers.
   */
  const cashTotal =
    quantityValue > 0 && costValue !== null && costValue > 0 && chargesValue !== null && chargesValue >= 0
      ? purchaseCashTotal(toDecimal(quantityValue), toDecimal(costValue), toDecimal(chargesValue))
      : null;

  const fundingMatchesHoldingCurrency =
    fundingAccount !== null && fundingAccount.currency === holdingCurrency;

  /**
   * A BUY ACROSS A CURRENCY BOUNDARY.
   *
   * The instrument prices in its own currency (Apple in dollars) and the
   * funding account counts in another (a sterling current account). The cash
   * that leaves is in the ACCOUNT's currency, so one conversion stands between
   * "units × price + charges" and the figure that moves.
   *
   * This used to be a refusal — "the app will not invent it from an exchange
   * rate" — which was right about inventing and wrong about helping: it left
   * the owner to do the arithmetic by hand on every foreign buy. What follows
   * offers a rate instead, says where it came from, lets it be overwritten,
   * and still leaves the total editable. Nothing is invented that is not shown
   * and attributed.
   */
  const needsConversion =
    fundingAccount !== null && fundingAccount.currency !== holdingCurrency;
  /**
   * The instrument prices in a currency the ACCOUNT does not count in. Wider
   * than `needsConversion` (which is about the chosen funding account),
   * because the reverse entry needs a rate to STORE the cost even when no
   * funding account is named — and the funding list is filtered to the
   * account's currency, so the two agree whenever both apply.
   */
  const crossCurrency = holdingCurrency !== currency;
  const enteringInAccountMoney = !editing && crossCurrency && entryCurrency === 'account';
  /** The money side of the conversion — the funding account's, or the account's own. */
  const moneyCurrency = fundingAccount?.currency ?? currency;
  const showRateBox = !editing && (needsConversion || enteringInAccountMoney);
  const fxQuote = useFxQuote(
    showRateBox ? holdingCurrency : null,
    showRateBox ? moneyCurrency : null
  );
  const rateValue = rateText === '' ? null : readPositiveRate(rateText);
  /** The currency the price and charges boxes are speaking, right now. */
  const entryCcy = enteringInAccountMoney ? currency : holdingCurrency;

  // A Decimal is a fresh object every render, so the effects below key on its
  // STRING — stable while the figure is, changed exactly when it changes.
  const cashTotalKey = cashTotal !== null ? cashTotal.toDecimalPlaces(2).toString() : null;

  // Keep the editable default in step with the figures above it — until the
  // owner types their own total, which is then theirs. cashTotal is already
  // in the money's currency in two cases: the funding account counts in the
  // instrument's currency, or the boxes themselves are speaking the account's
  // money (the reverse entry) — no rate touches it either way.
  const cashTotalIsMoney = fundingMatchesHoldingCurrency || enteringInAccountMoney;
  useEffect(() => {
    if (totalPaidTouched || !cashTotalIsMoney || cashTotalKey === null) return;
    setTotalPaid(cashTotalKey);
  }, [totalPaidTouched, cashTotalIsMoney, cashTotalKey]);

  // Seed the rate box from the quote, and only while the box is untouched: a
  // quote that resolves late must never overwrite a rate already typed.
  const quotedRateKey = fxQuote.status === 'ready' ? fxQuote.rate.toString() : null;
  useEffect(() => {
    if (rateTouched || quotedRateKey === null) return;
    setRateText(rateToDisplayString(toDecimal(quotedRateKey)));
  }, [rateTouched, quotedRateKey]);

  // The converted total, in the funding account's currency. Same rule as the
  // same-currency default: it fills the box, and the box stays editable —
  // the contract note wins over any arithmetic done here.
  const convertedTotalKey = (() => {
    if (!needsConversion || enteringInAccountMoney) return null;
    if (cashTotal === null || rateValue === null) return null;
    const converted = destinationForRate(cashTotal, rateValue);
    return converted.ok ? converted.value.toDecimalPlaces(AMOUNT_DP).toString() : null;
  })();
  useEffect(() => {
    if (totalPaidTouched || convertedTotalKey === null) return;
    setTotalPaid(convertedTotalKey);
  }, [totalPaidTouched, convertedTotalKey]);

  const previewCostBasis = cashTotal;
  const previewKey = previewCostBasis !== null ? previewCostBasis.toString() : null;

  // The preview in the owner's BASE currency, when the holding trades in
  // another. Display-only, today's cached rate — same convention as every
  // other converted figure in the app.
  const [baseEquivalent, setBaseEquivalent] = useState<DecimalInstance | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (previewKey === null || entryCcy === displayCurrency) {
      setBaseEquivalent(null);
      return;
    }
    void convert(toDecimal(previewKey), entryCcy).then((converted) => {
      if (!cancelled) setBaseEquivalent(converted);
    }).catch(() => {
      if (!cancelled) setBaseEquivalent(null);
    });
    return () => { cancelled = true; };
  }, [previewKey, entryCcy, displayCurrency, convert]);

  /**
   * The list's total, CONVERTED. Summing costBasis raw added dollars to
   * pounds the moment one holding traded in another currency — the exact
   * "portfolio balance correct in the user's base currency" ask.
   */
  const [totalCostBasisInBase, setTotalCostBasisInBase] = useState<DecimalInstance | null>(null);
  const mixedCurrencies = holdings.some((h) => (h.currency || currency) !== displayCurrency);
  useEffect(() => {
    let cancelled = false;
    void convertAndSum(
      holdings.map((h) => ({ amount: h.costBasis, currency: h.currency || currency }))
    ).then((total) => {
      if (!cancelled) setTotalCostBasisInBase(total);
    }).catch(() => {
      if (!cancelled) setTotalCostBasisInBase(null);
    });
    return () => { cancelled = true; };
  }, [holdings, currency, convertAndSum]);

  const handleSave = async (): Promise<void> => {
    setFormError('');

    if (!symbol) {
      setFormError('Choose a share, fund or ETF first');
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setFormError('Units must be a positive number');
      return;
    }

    if (costValue === null || !Number.isFinite(costValue) || costValue <= 0) {
      setFormError('Average cost must be a positive amount');
      return;
    }

    if (chargesValue === null || chargesValue < 0) {
      setFormError('Charges must be zero or more');
      return;
    }

    /**
     * THE REVERSE ENTRY'S CONVERSION. The boxes were speaking the account's
     * money; the holding is stored in the instrument's currency (its quotes
     * arrive in that currency, and a gain measured across two currencies is
     * not a gain). So the typed price and charges convert INTO the
     * instrument's currency here, at the rate on screen — division, because
     * the rate is quoted as 1 instrument-unit in account money. What the
     * owner typed is what the cash side uses; the stored figures are derived,
     * and the provenance note says at what rate.
     */
    let storedCost = toDecimal(costValue);
    let storedCharges = toDecimal(chargesValue);
    if (enteringInAccountMoney) {
      if (rateValue === null) {
        setFormError(
          `Enter the rate — 1 ${holdingCurrency} in ${currency} — so figures typed ` +
          `in ${currency} can be stored in the instrument's own currency`
        );
        return;
      }
      const costConverted = sourceForRate(storedCost, rateValue);
      const chargesConverted = storedCharges.greaterThan(0)
        ? sourceForRate(storedCharges, rateValue)
        : { ok: true as const, value: toDecimal(0) };
      if (!costConverted.ok || !chargesConverted.ok) {
        setFormError('That rate cannot convert these figures — check both');
        return;
      }
      storedCost = costConverted.value;
      storedCharges = chargesConverted.value;
    }

    const values: HoldingFormValues = {
      symbol,
      name: name.trim() || symbol,
      quantity: toDecimal(quantityValue),
      averageCost: storedCost,
      currency: holdingCurrency,
      assetType
    };

    let purchase: PurchaseDetails = {
      charges: storedCharges,
      fundingAccountId: null,
      totalPaid: null,
      date: new Date(`${purchaseDate}T00:00:00`),
      // In the reverse entry the conversion happened whether or not any money
      // moves: the stored cost derives from typed figures through the rate,
      // and that must be accountable even on a holding recorded with no
      // funding transfer.
      fx: enteringInAccountMoney && rateValue !== null
        ? {
            rate: rateValue,
            from: holdingCurrency,
            to: currency,
            source: !rateTouched && fxQuote.status === 'ready' && fxQuote.source === 'api'
              ? 'api'
              : 'manual',
            asOf: !rateTouched && fxQuote.status === 'ready' ? fxQuote.asOf : new Date()
          }
        : null
    };

    if (!editing && fundingAccountId !== '') {
      if (needsConversion && rateValue === null) {
        setFormError(
          `Enter the rate this purchase was converted at — 1 ${holdingCurrency} in ` +
          `${fundingAccount?.currency ?? 'the funding account’s currency'}`
        );
        return;
      }
      const paidValue = parseMoneyInput(totalPaid);
      if (paidValue === null || paidValue <= 0) {
        setFormError(
          needsConversion
            ? `Enter the total paid in ${fundingAccount?.currency ?? 'the funding account’s currency'} — the figure on the contract note`
            : 'Enter the total paid, including charges'
        );
        return;
      }
      if (Number.isNaN(purchase.date.getTime())) {
        setFormError('Enter the date the purchase settled');
        return;
      }
      purchase = {
        ...purchase,
        fundingAccountId,
        totalPaid: toDecimal(paidValue),
        /*
         * 'api' ONLY for a live quote accepted with no edit at all — the same
         * rule the cross-currency transfer dialog applies, and for the same
         * reason: the fallback table is wrong the day after it was written, so
         * stamping it with the provider's name would put their word on a
         * figure they never quoted. Accepting it is fine; the record then says
         * the owner answered for it.
         */
        fx: needsConversion && rateValue !== null && fundingAccount !== null
          ? {
              rate: rateValue,
              from: holdingCurrency,
              to: fundingAccount.currency,
              source: !rateTouched && fxQuote.status === 'ready' && fxQuote.source === 'api'
                ? 'api'
                : 'manual',
              asOf: !rateTouched && fxQuote.status === 'ready' ? fxQuote.asOf : new Date()
            }
          : null
      };
    }

    setIsSaving(true);
    try {
      if (editing) {
        await onEdit(editing.id, values);
      } else {
        await onAdd(values, purchase);
      }
      closeModal();
    } catch (error) {
      // The holding stays on screen with what the user typed, so nothing they
      // entered is lost to a failed save.
      setFormError(
        error instanceof Error ? error.message : 'That could not be saved. Try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Holdings ({holdings.length})
        </h3>
        <button
          type="button"
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
        >
          <PlusIcon size={20} aria-hidden="true" />
          Add Holding
        </button>
      </div>

      {listError && (
        <div role="alert" className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No holdings yet. Add the shares, funds or ETFs this account holds.
          </p>
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
          >
            <PlusIcon size={20} aria-hidden="true" />
            Add Your First Holding
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {holdings.map((holding) => (
            <div
              key={holding.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {holding.symbol}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    {ASSET_TYPE_LABELS[holding.assetType]}
                  </span>
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {formatDecimal(holding.quantity, 4)} units @{' '}
                  {formatCurrency(holding.averageCost, holding.currency || currency)}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cost basis</p>
                  <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(holding.costBasis, holding.currency || currency)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(holding)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label={`Edit ${holding.symbol}`}
                  >
                    <EditIcon size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(holding)}
                    disabled={deletingId === holding.id}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${holding.symbol}`}
                  >
                    <DeleteIcon size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-white">
                Total cost basis
                {/* Named only when it did WORK: with a dollar holding in the
                    list, an unlabelled total silently added currencies. */}
                {mixedCurrencies && (
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    in {displayCurrency}, at today's rate
                  </span>
                )}
              </span>
              <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {totalCostBasisInBase !== null ? formatCurrency(totalCostBasisInBase, displayCurrency) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={isAddOpen || editing !== null}
        onClose={closeModal}
        title={editing ? `Edit ${editing.symbol}` : 'Add a holding'}
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Share, fund or ETF
            </label>
            {pickingSymbol ? (
              <StockSymbolSearch
                onSelect={(picked, match) => {
                  setSymbol(picked);
                  setName(match.name);
                  setAssetType(assetTypeFromLookup(match.type));
                  setPickingSymbol(false);
                  if (!currencyTouched) {
                    setHoldingCurrency(defaultCurrencyFor(picked, match.exchange, currency));
                  }
                  loadQuote(picked);
                }}
                hint="Search by ticker or name — UK listings included (SHEL.L, VUSA.L)."
                autoFocus={!editing}
              />
            ) : (
              <div className="flex items-center justify-between gap-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900 dark:text-white">{symbol}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPickingSymbol(true)}
                  className="shrink-0 text-sm text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            )}
            {/* What the exchange says it trades at — the sanity check for the
                cost about to be typed, and the authority for the currency. */}
            {quoteLoading && (
              <p className={helperClass}>Checking the current price…</p>
            )}
            {quote && (
              <p className={helperClass}>
                Trading at {formatCurrency(toDecimal(quote.price), quote.currency)} ({quote.currency})
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="holding-asset-type" className={labelClass}>
                Kind
              </label>
              <select
                id="holding-asset-type"
                value={assetType}
                onChange={(e) => {
                  const chosen = INVESTMENT_ASSET_TYPES.find((type) => type === e.target.value);
                  if (chosen) setAssetType(chosen);
                }}
                disabled={isSaving}
                className={inputClass}
              >
                {INVESTMENT_ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="holding-quantity" className={labelClass}>
                Units held
              </label>
              <input
                id="holding-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                step="any"
                min="0"
                disabled={isSaving}
                className={inputClass}
              />
              <p className={helperClass}>
                Fractional units are fine.
              </p>
            </div>

            <div>
              <label htmlFor="holding-average-cost" className={labelClass}>
                Average cost per unit{!editing && crossCurrency ? ` (${entryCcy})` : ''}
              </label>
              <MoneyInput
                id="holding-average-cost"
                value={averageCost}
                onChange={setAverageCost}
                className={inputClass}
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="holding-currency" className={labelClass}>
                Priced in
              </label>
              {/* The instrument's own currency — set from the quote when one
                  arrives, editable always. Apple is dollars whatever currency
                  the account counts in. */}
              <select
                id="holding-currency"
                value={holdingCurrency}
                onChange={(e) => {
                  setHoldingCurrency(e.target.value);
                  setCurrencyTouched(true);
                }}
                disabled={isSaving}
                className={inputClass}
              >
                {supportedCurrencies.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </select>
            </div>

            {/* WHICH CURRENCY IS THE CONTRACT NOTE IN? (owner, 18 Aug: "enter
                the price and fees either in his base currency … or … in the
                investment local currency"). The holding is STORED in the
                instrument's currency either way — its quotes arrive in that
                currency, and a gain measured across two currencies is not a
                gain — so figures typed in the account's money convert at the
                rate box, and the note on the holding says so. */}
            {!editing && crossCurrency && (
              <div>
                <label htmlFor="holding-entry-currency" className={labelClass}>
                  Enter figures in
                </label>
                <select
                  id="holding-entry-currency"
                  value={entryCurrency}
                  onChange={(e) => {
                    setEntryCurrency(e.target.value === 'account' ? 'account' : 'instrument');
                    // The default total was computed under the old meaning of
                    // the boxes; recompute rather than carry a stale figure.
                    setTotalPaidTouched(false);
                    setTotalPaid('');
                  }}
                  disabled={isSaving}
                  className={inputClass}
                >
                  <option value="instrument">{holdingCurrency} — the instrument's currency</option>
                  <option value="account">{currency} — your money</option>
                </select>
                <p className={helperClass}>
                  {enteringInAccountMoney
                    ? `Stored in ${holdingCurrency} either way, converted at the rate below — so gains can be measured against its ${holdingCurrency} quotes.`
                    : `The contract note's figures, as the instrument prices them.`}
                </p>
              </div>
            )}
          </div>

          {!editing && (
            <>
              <div>
                <label htmlFor="holding-charges" className={labelClass}>
                  Charges — stamp duty, levies, commission ({entryCcy})
                </label>
                <MoneyInput
                  id="holding-charges"
                  value={charges}
                  onChange={setCharges}
                  className={inputClass}
                  disabled={isSaving}
                />
                <p className={helperClass}>
                  Folded into the cost basis, the way a contract note's total is.
                  Charged in another currency? Leave this at zero and put them in
                  the total paid below.
                </p>
              </div>

              <div>
                <label htmlFor="holding-funding" className={labelClass}>
                  Paid from
                </label>
                <select
                  id="holding-funding"
                  value={fundingAccountId}
                  onChange={(e) => {
                    setFundingAccountId(e.target.value);
                    setTotalPaidTouched(false);
                    setTotalPaid('');
                  }}
                  disabled={isSaving}
                  className={inputClass}
                >
                  <option value="">Just record the holding — no money moves</option>
                  {fundingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <p className={helperClass}>
                  Writes the transfer: out of the account you pick, into this
                  investment account. Accounts in other currencies are not
                  offered — a converted transfer needs its confirmed figure, so
                  make it from the register instead.
                </p>
              </div>

              {/* THE RATE, whenever a conversion stands anywhere in this buy:
                  between the instrument and the money that pays for it, or —
                  the reverse entry — between the figures being typed and the
                  currency the holding is stored in. Outside the funding block
                  because the second case needs no funding account at all. */}
              {showRateBox && (
                <div>
                  <label htmlFor="holding-fx-rate" className={labelClass}>
                    Rate: 1 {holdingCurrency} in {moneyCurrency}
                  </label>
                  <input
                    id="holding-fx-rate"
                    type="text"
                    inputMode="decimal"
                    value={rateText}
                    onChange={(event) => {
                      setRateText(event.target.value);
                      setRateTouched(true);
                    }}
                    className={inputClass}
                    disabled={isSaving}
                    placeholder="0.0000"
                  />
                  <p className={helperClass}>
                    {fxQuote.status === 'ready' && !rateTouched
                      ? `Today's rate, from ${fxQuote.provider}. Your broker's will differ — type theirs and the figures follow.`
                      : fxQuote.status === 'unavailable' && !rateTouched
                        ? 'No rate available for this pair — the one on your contract note is the one that happened.'
                        : 'Your rate for this purchase. The figures follow it.'}
                  </p>
                </div>
              )}

              {fundingAccountId !== '' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="holding-purchase-date" className={labelClass}>
                      Purchase date
                    </label>
                    <DatePicker
                      id="holding-purchase-date"
                      value={purchaseDate}
                      onChange={setPurchaseDate}
                      className={inputClass}
                      aria-label="Purchase date"
                      usePortal
                    />
                  </div>
                  <div>
                    <label htmlFor="holding-total-paid" className={labelClass}>
                      Total paid ({fundingAccount?.currency ?? currency})
                    </label>
                    <MoneyInput
                      id="holding-total-paid"
                      value={totalPaid}
                      onChange={(value) => {
                        setTotalPaid(value);
                        setTotalPaidTouched(true);
                      }}
                      className={inputClass}
                      disabled={isSaving}
                    />
                    <p className={helperClass}>
                      {needsConversion && !enteringInAccountMoney
                        ? `(Units × cost + charges) × the rate above — change it if the contract note says otherwise. The ${fundingAccount?.currency ?? 'account'} figure is what moves.`
                        : 'Units × cost + charges, prefilled — change it if the contract note says otherwise.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {previewCostBasis && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cost basis: {formatCurrency(previewCostBasis, entryCcy)}
                {chargesValue !== null && chargesValue > 0 && ' including charges'}
              </p>
              {baseEquivalent !== null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ {formatCurrency(baseEquivalent, displayCurrency)} at today's rate
                </p>
              )}
            </div>
          )}

          {formError && (
            <div role="alert" className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <LoadingButton
              isLoading={isSaving}
              onClick={() => void handleSave()}
              className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              loadingText="Saving…"
            >
              <CheckIcon size={16} className="mr-2" aria-hidden="true" />
              {editing ? 'Save changes' : 'Add holding'}
            </LoadingButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
