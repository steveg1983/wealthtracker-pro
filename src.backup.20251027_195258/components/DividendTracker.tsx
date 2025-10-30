import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dividendService } from '../services/dividendService';
import type { Dividend, DividendSummary, DividendProjection } from '../services/dividendService';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { parseCurrencyDecimal } from '../utils/currency-decimal';
import { toDecimal, toStorageNumber, type DecimalInstance } from '@wealthtracker/utils';
import type { Investment } from '../types';
import {
  TrendingUpIcon,
  CalendarIcon,
  DollarSignIcon,
  PieChartIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  DownloadIcon,
  AlertCircleIcon
} from './icons';
import { Modal, ModalBody, ModalFooter } from './common/Modal';

interface DividendTrackerProps {
  accountId?: string;
  investmentId?: string;
}

const formatDecimalAmount = (value: DecimalInstance | number, decimals: number): string => {
  const decimalValue = toDecimal(value).toDecimalPlaces(decimals);
  if (decimals === 0) {
    return decimalValue.toString();
  }
  const [integerPart, fractionalPart = ''] = decimalValue.toString().split('.');
  const paddedFraction = fractionalPart.padEnd(decimals, '0');
  return `${integerPart}.${paddedFraction.slice(0, decimals)}`;
};

export default function DividendTracker({ accountId, investmentId }: DividendTrackerProps) {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [projections, setProjections] = useState<DividendProjection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [dateRange, setDateRange] = useState<'ytd' | '1y' | '3y' | 'all'>('1y');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  
  const { accounts } = useApp();
  const { formatCurrency, getCurrencySymbol, displayCurrency } = useCurrencyDecimal();

  // Extract investments from accounts with holdings
  const investments = useMemo(() => {
    const allInvestments: Investment[] = [];
    accounts.forEach(account => {
      if (account.type === 'investment' && account.holdings) {
        account.holdings.forEach(holding => {
          allInvestments.push({
            id: `${account.id}-${holding.ticker}`,
            accountId: account.id,
            symbol: holding.ticker,
            name: holding.name,
            quantity: holding.shares,
            purchasePrice: holding.averageCost || 0,
            purchaseDate: new Date(),
            currentPrice: holding.currentPrice,
            currentValue: holding.marketValue || holding.value,
            averageCost: holding.averageCost || 0,
            createdAt: new Date()
          } as Investment);
        });
      }
    });
    return allInvestments;
  }, [accounts]);

  const loadDividends = useCallback(() => {
    // Calculate date range
    let startDate: Date | undefined;
    const today = new Date();
    
    switch (dateRange) {
      case 'ytd':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case '1y':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        break;
      case '3y':
        startDate = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
        break;
      case 'all':
        startDate = undefined;
        break;
    }

    // Load dividends
    const filters: Parameters<typeof dividendService.getDividends>[0] = {};
    if (accountId) {
      filters.accountId = accountId;
    }
    if (investmentId) {
      filters.investmentId = investmentId;
    }
    if (selectedSymbol) {
      filters.symbol = selectedSymbol;
    }
    if (startDate) {
      filters.startDate = startDate;
    }

    const divs = dividendService.getDividends(filters);
    setDividends(divs);

    // Load summary
    const sum = dividendService.getDividendSummary(startDate);
    setSummary(sum);

    // Load projections
    const holdings = investments
      .filter(inv => !accountId || inv.accountId === accountId)
      .map(inv => ({
        symbol: inv.symbol,
        shares: inv.quantity,
        currentValue: inv.currentValue
      }));
    
    const proj = dividendService.getDividendProjections(holdings);
    setProjections(proj);
  }, [accountId, investmentId, dateRange, selectedSymbol, investments]);

  useEffect(() => {
    loadDividends();
  }, [loadDividends]);

  // Get unique symbols from investments
  const symbols = Array.from(new Set(investments.map(inv => inv.symbol))).sort();

  const handleAddDividend = async (data: Partial<Dividend>) => {
    if (!data.symbol || !data.amount) return;

    const investment = investments.find(inv => inv.symbol === data.symbol);
    if (!investment) return;

    const dividend: Omit<Dividend, 'id'> = {
      investmentId: investment.id,
      accountId: investment.accountId,
      symbol: data.symbol,
      amount: data.amount,
      amountPerShare: data.amountPerShare ?? (investment.quantity ? data.amount / investment.quantity : data.amount),
      shares: investment.quantity,
      currency: displayCurrency,
      paymentDate: data.paymentDate ?? new Date(),
      exDividendDate: data.exDividendDate ?? new Date(),
      frequency: data.frequency ?? 'quarterly',
      type: data.type ?? 'regular',
      reinvested: data.reinvested ?? false
    };

    if (data.recordDate) {
      dividend.recordDate = data.recordDate;
    }
    if (data.declarationDate) {
      dividend.declarationDate = data.declarationDate;
    }
    if (typeof data.taxWithheld === 'number') {
      dividend.taxWithheld = data.taxWithheld;
    }
    if (typeof data.reinvestmentPrice === 'number') {
      dividend.reinvestmentPrice = data.reinvestmentPrice;
    }
    if (typeof data.reinvestmentShares === 'number') {
      dividend.reinvestmentShares = data.reinvestmentShares;
    }
    if (data.notes !== undefined) {
      dividend.notes = data.notes;
    }

    dividendService.addDividend(dividend);
    loadDividends();
    setShowAddModal(false);
  };

  const handleUpdateDividend = (dividendData: Partial<Dividend>) => {
    if (!editingDividend || !dividendData) return;

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(dividendData).filter(([, value]) => value !== undefined)
    ) as Partial<Dividend>;

    dividendService.updateDividend(editingDividend.id, sanitizedUpdates);
    loadDividends();
    setEditingDividend(null);
  };

  const handleDeleteDividend = (dividendId: string) => {
    if (confirm('Are you sure you want to delete this dividend record?')) {
      dividendService.deleteDividend(dividendId);
      loadDividends();
    }
  };

  const handleExport = () => {
    const csv = dividendService.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dividends-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as 'ytd' | '1y' | '3y' | 'all')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="ytd">Year to Date</option>
            <option value="1y">Last 12 Months</option>
            <option value="3y">Last 3 Years</option>
            <option value="all">All Time</option>
          </select>
          
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">All Symbols</option>
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <PlusIcon size={20} />
            Add Dividend
          </button>
          
          <button
            onClick={handleExport}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Export to CSV"
          >
            <DownloadIcon size={20} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Dividends</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalDividends.toNumber())}</p>
              </div>
              <DollarSignIcon size={32} className="text-green-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tax Withheld</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalTaxWithheld.toNumber())}</p>
              </div>
              <AlertCircleIcon size={32} className="text-orange-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Projected Annual</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.projectedAnnual.toNumber())}</p>
              </div>
              <TrendingUpIcon size={32} className="text-gray-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique Stocks</p>
                <p className="text-2xl font-bold">{Object.keys(summary.bySymbol).length}</p>
              </div>
              <PieChartIcon size={32} className="text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Dividends */}
      {projections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarIcon size={20} />
            Projected Upcoming Dividends
          </h3>
          
          <div className="space-y-2">
            {projections.slice(0, 5).map((proj, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{proj.symbol}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {proj.nextPaymentDate.toLocaleDateString()}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    proj.confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    proj.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {proj.confidence} confidence
                  </span>
                </div>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  +{formatCurrency(proj.estimatedAmount.toNumber())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dividend History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Dividend History</h3>
        
        {dividends.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No dividend records found</p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {dividends.map(dividend => {
                const amountPerShareDecimal = parseCurrencyDecimal(dividend.amountPerShare);
                const amountPerShareDisplay = formatDecimalAmount(amountPerShareDecimal, 4);

                return (
                  <div key={dividend.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-lg">{dividend.symbol}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {dividend.paymentDate.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingDividend(dividend)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-blue-900 dark:text-gray-500"
                          title="Edit"
                        >
                          <EditIcon size={20} />
                        </button>
                        <button
                          onClick={() => handleDeleteDividend(dividend.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:text-red-900 dark:text-red-400"
                          title="Delete"
                        >
                          <DeleteIcon size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        dividend.type === 'special' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {dividend.type}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {dividend.frequency}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block text-xs">Amount</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {formatCurrency(dividend.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block text-xs">Per Share</span>
                        <span className="text-gray-900 dark:text-white">
                          {getCurrencySymbol(displayCurrency)}{amountPerShareDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary dark:bg-gray-700">
                  <tr className="border-b border-[#5A729A] dark:border-gray-600">
                    <th className="text-left py-3 px-4 text-white text-sm font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-white text-sm font-medium">Symbol</th>
                    <th className="text-right py-3 px-4 text-white text-sm font-medium">Amount</th>
                    <th className="text-right py-3 px-4 text-white text-sm font-medium">Per Share</th>
                    <th className="text-center py-3 px-4 text-white text-sm font-medium">Type</th>
                    <th className="text-center py-3 px-4 text-white text-sm font-medium">Frequency</th>
                    <th className="text-right py-3 px-4 text-white text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dividends.map(dividend => {
                    const amountPerShareDecimal = parseCurrencyDecimal(dividend.amountPerShare);
                    const amountPerShareDisplay = formatDecimalAmount(amountPerShareDecimal, 4);
                    return (
                      <tr key={dividend.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-4">{dividend.paymentDate.toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-medium">{dividend.symbol}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(dividend.amount)}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">
                        {getCurrencySymbol(displayCurrency)}{amountPerShareDisplay}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          dividend.type === 'special' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}>
                          {dividend.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">{dividend.frequency}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingDividend(dividend)}
                            className="p-1 text-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                            title="Edit"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteDividend(dividend.id)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                            title="Delete"
                          >
                            <DeleteIcon size={16} />
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dividend Modal */}
      {(showAddModal || editingDividend) && (
        <DividendModal
          dividend={editingDividend}
          symbols={symbols}
          onSave={editingDividend ? handleUpdateDividend : handleAddDividend}
          onClose={() => {
            setShowAddModal(false);
            setEditingDividend(null);
          }}
        />
      )}
    </div>
  );
}

// Dividend Modal Component
interface DividendModalProps {
  dividend: Dividend | null;
  symbols: string[];
  onSave: (dividend: Partial<Dividend>) => void;
  onClose: () => void;
}

function DividendModal({ dividend, symbols, onSave, onClose }: DividendModalProps) {
  const [formData, setFormData] = useState({
    symbol: dividend?.symbol || '',
    amount: dividend?.amount || 0,
    amountPerShare: dividend?.amountPerShare || 0,
    paymentDate: dividend?.paymentDate || new Date(),
    exDividendDate: dividend?.exDividendDate || new Date(),
    recordDate: dividend?.recordDate,
    declarationDate: dividend?.declarationDate,
    frequency: dividend?.frequency || 'quarterly',
    type: dividend?.type || 'regular',
    taxWithheld: dividend?.taxWithheld || 0,
    reinvested: dividend?.reinvested || false,
    reinvestmentPrice: dividend?.reinvestmentPrice || 0,
    reinvestmentShares: dividend?.reinvestmentShares || 0,
    notes: dividend?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = Object.fromEntries(
      Object.entries(formData).filter(([, value]) => value !== undefined)
    ) as Partial<Dividend>;

    onSave(payload);
  };

  return (
    <Modal isOpen onClose={onClose} title={dividend ? 'Edit Dividend' : 'Add Dividend'}>
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Symbol</label>
              <select
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              >
                <option value="">Select symbol</option>
                {symbols.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Total Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({
                  ...formData,
                  amount: toStorageNumber(parseCurrencyDecimal(e.target.value))
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input
                type="date"
                value={formData.paymentDate.toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, paymentDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Ex-Dividend Date</label>
              <input
                type="date"
                value={formData.exDividendDate.toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, exDividendDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Dividend['frequency'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="annual">Annual</option>
                <option value="special">Special</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Dividend['type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="regular">Regular</option>
                <option value="special">Special</option>
                <option value="qualified">Qualified</option>
                <option value="non-qualified">Non-Qualified</option>
                <option value="return-of-capital">Return of Capital</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tax Withheld</label>
              <input
                type="number"
                step="0.01"
                value={formData.taxWithheld}
                onChange={(e) => setFormData({
                  ...formData,
                  taxWithheld: toStorageNumber(parseCurrencyDecimal(e.target.value))
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.reinvested}
                  onChange={(e) => setFormData({ ...formData, reinvested: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium">Reinvested</span>
              </label>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              rows={2}
            />
          </div>
        </ModalBody>
        
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {dividend ? 'Update' : 'Add'} Dividend
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
