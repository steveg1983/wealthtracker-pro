import { useState } from 'react';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, parseMoneyInput } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import MoneyInput from './common/MoneyInput';
import StockSymbolSearch from './StockSymbolSearch';
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
 */

/** What a save needs, independent of whether it is an add or an edit. */
export interface HoldingFormValues {
  symbol: string;
  name: string;
  quantity: ReturnType<typeof toDecimal>;
  averageCost: ReturnType<typeof toDecimal>;
  assetType: InvestmentAssetType;
}

interface PortfolioManagerProps {
  holdings: readonly InvestmentHolding[];
  /** The account's currency — what the cost figures are entered in. */
  currency: string;
  onAdd: (values: HoldingFormValues) => Promise<void>;
  onEdit: (id: string, values: HoldingFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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

export default function PortfolioManager({
  holdings,
  currency,
  onAdd,
  onEdit,
  onDelete
}: PortfolioManagerProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
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

  const resetForm = (): void => {
    setSymbol('');
    setName('');
    setAssetType('stock');
    setPickingSymbol(true);
    setQuantity('');
    setAverageCost('');
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

  const startEdit = (holding: InvestmentHolding): void => {
    setFormError('');
    setSymbol(holding.symbol);
    setName(holding.name);
    setAssetType(holding.assetType);
    setPickingSymbol(false);
    setQuantity(holding.quantity.toString());
    setAverageCost(holding.averageCost.toString());
    setEditing(holding);
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

  const handleSave = async (): Promise<void> => {
    setFormError('');

    if (!symbol) {
      setFormError('Choose a share, fund or ETF first');
      return;
    }

    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setFormError('Units must be a positive number');
      return;
    }

    const costValue = parseMoneyInput(averageCost);
    if (costValue === null || !Number.isFinite(costValue) || costValue <= 0) {
      setFormError('Average cost must be a positive amount');
      return;
    }

    const values: HoldingFormValues = {
      symbol,
      name: name.trim() || symbol,
      quantity: toDecimal(quantityValue),
      averageCost: toDecimal(costValue),
      assetType
    };

    setIsSaving(true);
    try {
      if (editing) {
        await onEdit(editing.id, values);
      } else {
        await onAdd(values);
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

  const totalCostBasis = holdings.reduce((sum, h) => sum.plus(h.costBasis), toDecimal(0));

  const previewCostBasis =
    quantity && averageCost && Number.isFinite(Number(quantity)) && parseMoneyInput(averageCost) !== null
      ? toDecimal(Number(quantity)).times(toDecimal(parseMoneyInput(averageCost) ?? 0))
      : null;

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
              <span className="font-semibold text-gray-900 dark:text-white">Total cost basis</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(totalCostBasis, currency)}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Share, fund or ETF
            </label>
            {pickingSymbol ? (
              <StockSymbolSearch
                onSelect={(picked, match) => {
                  setSymbol(picked);
                  setName(match.name);
                  setAssetType(assetTypeFromLookup(match.type));
                  setPickingSymbol(false);
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
          </div>

          <div>
            <label
              htmlFor="holding-asset-type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {INVESTMENT_ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSET_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="holding-quantity"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Fractional units are fine — funds are usually held to several decimal places.
            </p>
          </div>

          <div>
            <label
              htmlFor="holding-average-cost"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Average cost per unit ({currency})
            </label>
            <MoneyInput
              id="holding-average-cost"
              value={averageCost}
              onChange={setAverageCost}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={isSaving}
            />
          </div>

          {previewCostBasis && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cost basis: {formatCurrency(previewCostBasis, currency)}
              </p>
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
