import React, { useState, useEffect, useCallback } from 'react';
import { businessService } from '../services/businessService';
import { 
  MapPinIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  DollarSignIcon,
  FilterIcon,
  TrendingUpIcon,
  CarIcon
} from './icons';
import type { MileageEntry } from '../services/businessService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';

const formatNumber = (value: DecimalInstance | number, decimals: number): string => {
  return formatDecimal(value, decimals);
};

interface MileageTrackerProps {
  onDataChange: () => void;
}

export default function MileageTracker({ onDataChange }: MileageTrackerProps) {
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<MileageEntry[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MileageEntry | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    dateRange: ''
  });
  const { formatCurrency } = useCurrencyDecimal();

  useEffect(() => {
    loadMileageEntries();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...mileageEntries];

    if (filters.category) {
      filtered = filtered.filter(entry => entry.category === filters.category);
    }

    if (filters.dateRange) {
      const now = new Date();
      let startDate = new Date();
      
      switch (filters.dateRange) {
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'this-quarter': {
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        }
        case 'this-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      filtered = filtered.filter(entry => entry.date >= startDate);
    }

    setFilteredEntries(filtered);
  }, [filters, mileageEntries]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadMileageEntries = () => {
    const entries = businessService.getMileageEntries();
    setMileageEntries(entries);
  };

  const handleCreateEntry = () => {
    setEditingEntry(null);
    setShowCreateModal(true);
  };

  const handleEditEntry = (entry: MileageEntry) => {
    setEditingEntry(entry);
    setShowCreateModal(true);
  };

  const handleDeleteEntry = (entry: MileageEntry) => {
    if (window.confirm('Are you sure you want to delete this mileage entry?')) {
      businessService.deleteMileageEntry(entry.id);
      loadMileageEntries();
      onDataChange();
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryColor = (category: MileageEntry['category']) => {
    switch (category) {
      case 'business':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'medical':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'charitable':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'moving':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const totalMilesDecimal = filteredEntries.reduce(
    (sum, entry) => sum.plus(entry.distance),
    toDecimal(0)
  );
  const totalMilesDisplay = formatNumber(totalMilesDecimal, 1);
  const totalAmountDecimal = filteredEntries.reduce(
    (sum, entry) => sum.plus(entry.amount),
    toDecimal(0)
  );
  const averageRateDecimal = filteredEntries.length > 0 
    ? filteredEntries.reduce((sum, entry) => sum.plus(entry.rate), toDecimal(0)).dividedBy(filteredEntries.length)
    : toDecimal(0);
  const averageRateDisplay = formatCurrency(averageRateDecimal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mileage Tracker</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track business mileage for tax deductions
          </p>
        </div>
        <button
          onClick={handleCreateEntry}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          <span className="hidden sm:inline">Add Mileage</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Miles</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalMilesDisplay}
              </p>
            </div>
            <MapPinIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalAmountDecimal)}
              </p>
            </div>
            <DollarSignIcon size={24} className="text-green-500" />
          </div>
        </div>

        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Average Rate</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {`${averageRateDisplay}/mi`}
              </p>
            </div>
            <TrendingUpIcon size={24} className="text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="business">Business</option>
              <option value="medical">Medical</option>
              <option value="charitable">Charitable</option>
              <option value="moving">Moving</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mileage Entries List */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <CarIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No mileage entries found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {mileageEntries.length === 0 ? 'Add your first mileage entry to get started' : 'Try adjusting your filters'}
            </p>
            {mileageEntries.length === 0 && (
              <button
                onClick={handleCreateEntry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                <span>Add Mileage</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="bg-[#d4dce8] dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {entry.startLocation} → {entry.endLocation}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {entry.purpose}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <EditIcon size={20} />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getCategoryColor(entry.category)}`}>
                      {entry.category}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.date)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">Distance</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {formatNumber(entry.distance, 1)} mi
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">Rate</span>
                      <span className="text-gray-900 dark:text-white">
                        {`${formatCurrency(entry.rate)}/mi`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">Amount</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
              <thead className="bg-secondary dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Trip
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#d4dce8] dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPinIcon size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {entry.startLocation} → {entry.endLocation}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {entry.purpose}
                          </div>
                          {entry.notes && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getCategoryColor(entry.category)}`}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatNumber(entry.distance, 1)} mi
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {`${formatCurrency(entry.rate)}/mi`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <EditIcon size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <MileageEntryModal
          entry={editingEntry}
          onClose={() => setShowCreateModal(false)}
          onSave={(entry) => {
            if (editingEntry) {
              businessService.updateMileageEntry(editingEntry.id, entry);
            } else {
              businessService.addMileageEntry(entry);
            }
            setShowCreateModal(false);
            loadMileageEntries();
            onDataChange();
          }}
        />
      )}
    </div>
  );
}

// Mileage Entry Modal Component
interface MileageEntryModalProps {
  entry: MileageEntry | null;
  onClose: () => void;
  onSave: (entry: Omit<MileageEntry, 'id' | 'amount' | 'createdAt'>) => void;
}

function MileageEntryModal({ entry, onClose, onSave }: MileageEntryModalProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [formData, setFormData] = useState({
    date: entry?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    startLocation: entry?.startLocation || '',
    endLocation: entry?.endLocation || '',
    distance: entry?.distance || 0,
    purpose: entry?.purpose || '',
    rate: entry?.rate || 0.67, // 2024 IRS standard mileage rate
    category: entry?.category || 'business' as MileageEntry['category'],
    notes: entry?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      date: new Date(formData.date)
    });
  };

  const calculatedAmount = toDecimal(formData.distance).times(formData.rate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl w-full max-w-lg">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {entry ? 'Edit Mileage Entry' : 'Add Mileage Entry'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Location
              </label>
              <input
                type="text"
                value={formData.startLocation}
                onChange={(e) => setFormData({ ...formData, startLocation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter starting location"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Location
              </label>
              <input
                type="text"
                value={formData.endLocation}
                onChange={(e) => setFormData({ ...formData, endLocation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter destination"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Distance (miles)
                </label>
                <input
                  type="number"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.0"
                  step="0.1"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rate (per mile)
                </label>
                <input
                  type="number"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.67"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Purpose
              </label>
              <input
                type="text"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter purpose of trip"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as MileageEntry['category'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="business">Business</option>
                <option value="medical">Medical</option>
                <option value="charitable">Charitable</option>
                <option value="moving">Moving</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder="Additional details..."
              />
            </div>

            {/* Calculated Amount */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calculated Amount:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(calculatedAmount)}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {`${formatNumber(formData.distance, 1)} miles × ${formatCurrency(formData.rate)}/mile`}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              {entry ? 'Update' : 'Add'} Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
