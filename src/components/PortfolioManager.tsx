import React, { useState } from 'react';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { validateSymbol } from '../services/stockPriceService';
import { 
  PlusIcon, 
  EditIcon, 
  DeleteIcon, 
  SearchIcon,
  CheckIcon
} from './icons';
import { Modal } from './common/Modal';
import { LoadingButton } from './loading/LoadingState';
import type { DecimalInstance } from '../types/decimal-types';

interface StockHolding {
  id: string;
  symbol: string;
  shares: DecimalInstance;
  averageCost: DecimalInstance;
  costBasis: DecimalInstance;
  dateAdded: Date;
}

interface PortfolioManagerProps {
  accountId: string;
  holdings: StockHolding[];
  onUpdate: (holdings: StockHolding[]) => void;
}

export default function PortfolioManager({ accountId: _accountId, holdings, onUpdate }: PortfolioManagerProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<StockHolding | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Form state
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [averageCost, setAverageCost] = useState('');

  const resetForm = () => {
    setSymbol('');
    setShares('');
    setAverageCost('');
    setValidationError('');
  };

  const handleAddHolding = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleEditHolding = (holding: StockHolding) => {
    setEditingHolding(holding);
    setSymbol(holding.symbol);
    setShares(holding.shares.toString());
    setAverageCost(holding.averageCost.toString());
    setValidationError('');
  };

  const handleDeleteHolding = (holdingId: string) => {
    if (confirm('Are you sure you want to remove this holding?')) {
      const updatedHoldings = holdings.filter(h => h.id !== holdingId);
      onUpdate(updatedHoldings);
    }
  };

  const validateAndSaveHolding = async () => {
    setValidationError('');
    
    // Basic validation
    if (!symbol || !shares || !averageCost) {
      setValidationError('All fields are required');
      return;
    }

    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(averageCost);

    if (isNaN(sharesNum) || sharesNum <= 0) {
      setValidationError('Shares must be a positive number');
      return;
    }

    if (isNaN(costNum) || costNum <= 0) {
      setValidationError('Average cost must be a positive number');
      return;
    }

    // Validate symbol exists
    setIsValidating(true);
    try {
      const isValid = await validateSymbol(symbol);
      if (!isValid) {
        setValidationError(`Symbol "${symbol}" not found. Please check and try again.`);
        setIsValidating(false);
        return;
      }
    } catch {
      setValidationError('Unable to validate symbol. Please try again.');
      setIsValidating(false);
      return;
    }
    setIsValidating(false);

    // Create or update holding
    const sharesDecimal = toDecimal(sharesNum);
    const costDecimal = toDecimal(costNum);
    const costBasis = sharesDecimal.times(costDecimal);

    if (editingHolding) {
      // Update existing
      const updatedHoldings = holdings.map(h => 
        h.id === editingHolding.id
          ? {
              ...h,
              symbol: symbol.toUpperCase(),
              shares: sharesDecimal,
              averageCost: costDecimal,
              costBasis
            }
          : h
      );
      onUpdate(updatedHoldings);
      setEditingHolding(null);
    } else {
      // Add new
      const newHolding: StockHolding = {
        id: `holding-${Date.now()}`,
        symbol: symbol.toUpperCase(),
        shares: sharesDecimal,
        averageCost: costDecimal,
        costBasis,
        dateAdded: new Date()
      };
      onUpdate([...holdings, newHolding]);
      setIsAddModalOpen(false);
    }

    resetForm();
  };

  const totalCostBasis = holdings.reduce((sum, h) => sum.plus(h.costBasis), toDecimal(0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Holdings ({holdings.length})
        </h3>
        <button
          onClick={handleAddHolding}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
        >
          <PlusIcon size={20} />
          Add Holding
        </button>
      </div>

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No holdings yet. Add stocks to track your portfolio performance.
          </p>
          <button
            onClick={handleAddHolding}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
          >
            <PlusIcon size={20} />
            Add Your First Stock
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {holdings.map((holding) => (
            <div
              key={holding.id}
              className="flex items-center justify-between p-4 bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {holding.symbol}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDecimal(holding.shares, 2)} shares @ {formatCurrency(holding.averageCost)}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cost Basis</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(holding.costBasis)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditHolding(holding)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Edit holding"
                  >
                    <EditIcon size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteHolding(holding.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Remove holding"
                  >
                    <DeleteIcon size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-white">
                Total Cost Basis
              </span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalCostBasis)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || !!editingHolding}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingHolding(null);
          resetForm();
        }}
        title={editingHolding ? 'Edit Holding' : 'Add Stock Holding'}
      >
        <div className="space-y-4">
          {/* Symbol Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stock Symbol
            </label>
            <div className="relative">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL, MSFT, GOOGL..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white uppercase"
                disabled={isValidating}
              />
              <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Shares Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Shares
            </label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={isValidating}
            />
          </div>

          {/* Average Cost Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Average Cost per Share
            </label>
            <input
              type="number"
              value={averageCost}
              onChange={(e) => setAverageCost(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={isValidating}
            />
          </div>

          {/* Cost Basis Preview */}
          {shares && averageCost && !isNaN(parseFloat(shares)) && !isNaN(parseFloat(averageCost)) && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cost Basis: {formatCurrency(toDecimal(parseFloat(shares) * parseFloat(averageCost)))}
              </p>
            </div>
          )}

          {/* Error Message */}
          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingHolding(null);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <LoadingButton
              isLoading={isValidating}
              onClick={validateAndSaveHolding}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              loadingText="Validating..."
            >
              <CheckIcon size={16} className="mr-2" />
              {editingHolding ? 'Update' : 'Add'} Holding
            </LoadingButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
