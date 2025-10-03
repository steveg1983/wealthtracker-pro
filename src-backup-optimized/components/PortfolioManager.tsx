/**
 * PortfolioManager Component - Portfolio management and configuration
 *
 * Features:
 * - Add/remove portfolio holdings
 * - Edit investment details
 * - Rebalancing recommendations
 * - Performance tracking setup
 * - Import/export functionality
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface Investment {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'real_estate';
  shares: number;
  purchasePrice: number;
  purchaseDate: Date;
  currentPrice?: number;
  notes?: string;
}

interface PortfolioManagerProps {
  userId?: string;
  onInvestmentChange?: (investments: Investment[]) => void;
  className?: string;
}

const investmentTypes = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'real_estate', label: 'Real Estate' }
];

export default function PortfolioManager({
  userId,
  onInvestmentChange,
  className = ''
}: PortfolioManagerProps): React.JSX.Element {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isAddingInvestment, setIsAddingInvestment] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newInvestment, setNewInvestment] = useState<Partial<Investment>>({
    type: 'stock',
    shares: 0,
    purchasePrice: 0,
    purchaseDate: new Date()
  });

  // Load investments
  useEffect(() => {
    const loadInvestments = async () => {
      setIsLoading(true);
      try {
        logger.debug('Loading investments for user:', userId);

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        // Mock data
        const mockInvestments: Investment[] = [
          {
            id: 'inv-1',
            symbol: 'AAPL',
            name: 'Apple Inc.',
            type: 'stock',
            shares: 50,
            purchasePrice: 160.00,
            purchaseDate: new Date('2024-01-15'),
            currentPrice: 175.50,
            notes: 'Long-term growth play'
          },
          {
            id: 'inv-2',
            symbol: 'VTSAX',
            name: 'Vanguard Total Stock Market Index',
            type: 'mutual_fund',
            shares: 100,
            purchasePrice: 105.00,
            purchaseDate: new Date('2024-02-01'),
            currentPrice: 112.30
          }
        ];

        setInvestments(mockInvestments);
        onInvestmentChange?.(mockInvestments);
        logger.debug('Investments loaded successfully');
      } catch (error) {
        logger.error('Error loading investments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInvestments();
  }, [userId, onInvestmentChange]);

  const handleAddInvestment = async () => {
    if (!newInvestment.symbol || !newInvestment.name || !newInvestment.shares || !newInvestment.purchasePrice) {
      return;
    }

    try {
      const investment: Investment = {
        id: `inv-${Date.now()}`,
        symbol: newInvestment.symbol.toUpperCase(),
        name: newInvestment.name,
        type: newInvestment.type as Investment['type'],
        shares: newInvestment.shares,
        purchasePrice: newInvestment.purchasePrice,
        purchaseDate: newInvestment.purchaseDate || new Date(),
        notes: newInvestment.notes
      };

      const updatedInvestments = [...investments, investment];
      setInvestments(updatedInvestments);
      onInvestmentChange?.(updatedInvestments);

      // Reset form
      setNewInvestment({
        type: 'stock',
        shares: 0,
        purchasePrice: 0,
        purchaseDate: new Date()
      });
      setIsAddingInvestment(false);

      logger.debug('Investment added:', investment);
    } catch (error) {
      logger.error('Error adding investment:', error);
    }
  };

  const handleEditInvestment = async (investment: Investment) => {
    try {
      const updatedInvestments = investments.map(inv =>
        inv.id === investment.id ? investment : inv
      );
      setInvestments(updatedInvestments);
      onInvestmentChange?.(updatedInvestments);
      setEditingInvestment(null);

      logger.debug('Investment updated:', investment);
    } catch (error) {
      logger.error('Error updating investment:', error);
    }
  };

  const handleDeleteInvestment = async (investmentId: string) => {
    try {
      const updatedInvestments = investments.filter(inv => inv.id !== investmentId);
      setInvestments(updatedInvestments);
      onInvestmentChange?.(updatedInvestments);

      logger.debug('Investment deleted:', investmentId);
    } catch (error) {
      logger.error('Error deleting investment:', error);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const calculateGainLoss = (investment: Investment): { amount: number; percentage: number } => {
    if (!investment.currentPrice) {
      return { amount: 0, percentage: 0 };
    }

    const currentValue = investment.shares * investment.currentPrice;
    const costBasis = investment.shares * investment.purchasePrice;
    const gainLoss = currentValue - costBasis;
    const percentage = (gainLoss / costBasis) * 100;

    return { amount: gainLoss, percentage };
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Portfolio Manager
        </h2>
        <button
          onClick={() => setIsAddingInvestment(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          Add Investment
        </button>
      </div>

      {/* Add Investment Form */}
      {isAddingInvestment && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Add New Investment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={newInvestment.symbol || ''}
                onChange={(e) => setNewInvestment({ ...newInvestment, symbol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="e.g., AAPL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newInvestment.name || ''}
                onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="e.g., Apple Inc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={newInvestment.type}
                onChange={(e) => setNewInvestment({ ...newInvestment, type: e.target.value as Investment['type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              >
                {investmentTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shares
              </label>
              <input
                type="number"
                value={newInvestment.shares || ''}
                onChange={(e) => setNewInvestment({ ...newInvestment, shares: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purchase Price
              </label>
              <input
                type="number"
                value={newInvestment.purchasePrice || ''}
                onChange={(e) => setNewInvestment({ ...newInvestment, purchasePrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={newInvestment.purchaseDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setNewInvestment({ ...newInvestment, purchaseDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={newInvestment.notes || ''}
              onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              rows={2}
              placeholder="Investment notes or strategy..."
            />
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleAddInvestment}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
            >
              Add Investment
            </button>
            <button
              onClick={() => setIsAddingInvestment(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Investments List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {investments.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No investments yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add your first investment to start tracking your portfolio performance.
            </p>
            <button
              onClick={() => setIsAddingInvestment(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Add Investment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Investment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Current Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gain/Loss
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {investments.map(investment => {
                  const gainLoss = calculateGainLoss(investment);
                  return (
                    <tr key={investment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {investment.symbol}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {investment.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                          {investmentTypes.find(t => t.value === investment.type)?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {investment.shares}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(investment.purchasePrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {investment.currentPrice
                          ? formatCurrency(investment.shares * investment.currentPrice)
                          : 'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {investment.currentPrice ? (
                          <div>
                            <div className={`text-sm ${gainLoss.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(gainLoss.amount)}
                            </div>
                            <div className={`text-xs ${gainLoss.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {gainLoss.percentage >= 0 ? '+' : ''}{gainLoss.percentage.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setEditingInvestment(investment)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteInvestment(investment.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}