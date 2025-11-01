import React, { useState, useEffect, useCallback } from 'react';
import { businessService } from '../services/businessService';
import { 
  DollarSignIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  FilterIcon,
  TagIcon,
  CalendarIcon,
  FileTextIcon
} from './icons';
import type { BusinessExpense, BusinessExpenseCategory } from '../services/businessService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';

interface BusinessExpenseManagerProps {
  onDataChange: () => void;
}

export default function BusinessExpenseManager({ onDataChange }: BusinessExpenseManagerProps) {
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<BusinessExpense[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    isDeductible: '',
    dateRange: ''
  });
  const { formatCurrency } = useCurrencyDecimal();

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadExpenses = () => {
    const businessExpenses = businessService.getBusinessExpenses();
    setExpenses(businessExpenses);
  };

  const applyFilters = useCallback(() => {
    let filtered = [...expenses];

    if (filters.category) {
      filtered = filtered.filter(expense => expense.category === filters.category);
    }

    if (filters.isDeductible) {
      const isDeductible = filters.isDeductible === 'true';
      filtered = filtered.filter(expense => expense.isDeductible === isDeductible);
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
      
      filtered = filtered.filter(expense => expense.date >= startDate);
    }

    setFilteredExpenses(filtered);
  }, [expenses, filters]);

  const handleCreateExpense = () => {
    setEditingExpense(null);
    setShowCreateModal(true);
  };

  const handleEditExpense = (expense: BusinessExpense) => {
    setEditingExpense(expense);
    setShowCreateModal(true);
  };

  const handleDeleteExpense = (expense: BusinessExpense) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      businessService.deleteBusinessExpense(expense.id);
      loadExpenses();
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

  const getCategoryName = (category: BusinessExpenseCategory) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryIcon = (category: BusinessExpenseCategory) => {
    switch (category) {
      case 'office_supplies':
        return <FileTextIcon size={16} className="text-blue-500" />;
      case 'travel':
        return <CalendarIcon size={16} className="text-green-500" />;
      case 'meals':
        return <DollarSignIcon size={16} className="text-orange-500" />;
      case 'software':
        return <TagIcon size={16} className="text-purple-500" />;
      default:
        return <DollarSignIcon size={16} className="text-gray-500" />;
    }
  };

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum.plus(expense.amount),
    toDecimal(0)
  );
  const deductibleExpenses = filteredExpenses
    .filter(expense => expense.isDeductible)
    .reduce((sum, expense) => sum.plus(expense.amount), toDecimal(0));
  const totalVAT = filteredExpenses.reduce(
    (sum, expense) => sum.plus(expense.vatAmount || 0),
    toDecimal(0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Business Expenses</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track and categorize your business expenses
          </p>
        </div>
        <button
          onClick={handleCreateExpense}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <DollarSignIcon size={24} className="text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Deductible Expenses</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(deductibleExpenses)}
              </p>
            </div>
            <CheckCircleIcon size={24} className="text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total VAT</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalVAT)}
              </p>
            </div>
            <FileTextIcon size={24} className="text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <option value="office_supplies">Office Supplies</option>
              <option value="travel">Travel</option>
              <option value="meals">Meals</option>
              <option value="utilities">Utilities</option>
              <option value="rent">Rent</option>
              <option value="marketing">Marketing</option>
              <option value="professional_services">Professional Services</option>
              <option value="equipment">Equipment</option>
              <option value="software">Software</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deductible
            </label>
            <select
              value={filters.isDeductible}
              onChange={(e) => setFilters({ ...filters, isDeductible: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Expenses</option>
              <option value="true">Deductible Only</option>
              <option value="false">Non-Deductible Only</option>
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

      {/* Expenses List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12">
            <DollarSignIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No expenses found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {expenses.length === 0 ? 'Add your first business expense to get started' : 'Try adjusting your filters'}
            </p>
            {expenses.length === 0 && (
              <button
                onClick={handleCreateExpense}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                Add Expense
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(expense.category)}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {expense.description}
                        </p>
                        {expense.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {expense.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditExpense(expense)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600 hover:text-blue-900 dark:text-blue-400"
                      >
                        <EditIcon size={20} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        <TrashIcon size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {getCategoryName(expense.category)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(expense.date)}
                    </span>
                    {expense.isDeductible ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                        <CheckCircleIcon size={14} />
                        Deductible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                        <XCircleIcon size={14} />
                        Non-deductible
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">Amount</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {formatCurrency(toDecimal(expense.amount))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">VAT</span>
                      <span className="text-gray-900 dark:text-white">
                        {expense.vatAmount ? formatCurrency(toDecimal(expense.vatAmount)) : '-'}
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
                      Expense
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Deductible
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getCategoryIcon(expense.category)}
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {expense.description}
                            </div>
                            {expense.notes && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {expense.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {getCategoryName(expense.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatCurrency(toDecimal(expense.amount))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {expense.vatAmount ? formatCurrency(toDecimal(expense.vatAmount)) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.isDeductible ? (
                          <CheckCircleIcon size={16} className="text-green-500" />
                        ) : (
                          <XCircleIcon size={16} className="text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense)}
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
        <BusinessExpenseModal
          expense={editingExpense}
          onClose={() => setShowCreateModal(false)}
          onSave={(expense) => {
            if (editingExpense) {
              businessService.updateBusinessExpense(editingExpense.id, expense);
            } else {
              businessService.addBusinessExpense(expense);
            }
            setShowCreateModal(false);
            loadExpenses();
            onDataChange();
          }}
        />
      )}
    </div>
  );
}

// Business Expense Modal Component
interface BusinessExpenseModalProps {
  expense: BusinessExpense | null;
  onClose: () => void;
  onSave: (expense: Omit<BusinessExpense, 'id' | 'createdAt'>) => void;
}

function BusinessExpenseModal({ expense, onClose, onSave }: BusinessExpenseModalProps) {
  const [formData, setFormData] = useState({
    date: expense?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    description: expense?.description || '',
    amount: expense?.amount || 0,
    category: expense?.category || 'other' as BusinessExpenseCategory,
    vatAmount: expense?.vatAmount || 0,
    isDeductible: expense?.isDeductible ?? true,
    notes: expense?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      date: new Date(formData.date),
      vatAmount: formData.vatAmount || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {expense ? 'Edit Expense' : 'Add Expense'}
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
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter expense description"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as BusinessExpenseCategory })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="office_supplies">Office Supplies</option>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
                <option value="utilities">Utilities</option>
                <option value="rent">Rent</option>
                <option value="marketing">Marketing</option>
                <option value="professional_services">Professional Services</option>
                <option value="equipment">Equipment</option>
                <option value="software">Software</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                VAT Amount (Optional)
              </label>
              <input
                type="number"
                value={formData.vatAmount}
                onChange={(e) => setFormData({ ...formData, vatAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDeductible}
                  onChange={(e) => setFormData({ ...formData, isDeductible: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Tax deductible
                </span>
              </label>
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
                placeholder="Additional notes..."
              />
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
              {expense ? 'Update' : 'Add'} Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
