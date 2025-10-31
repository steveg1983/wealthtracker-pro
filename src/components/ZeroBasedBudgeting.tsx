import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import {
  CalculatorIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  TrendingUpIcon,
  RefreshCwIcon
} from './icons';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import type { Category } from '../types';

interface ZeroBudgetItem {
  id: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  priority: 'essential' | 'important' | 'nice-to-have';
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  isRecurring: boolean;
  isApproved: boolean;
}

interface SavedZeroBudgetPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  items: Array<{
    id: string;
    category: string;
    subcategory?: string;
    description: string;
    amount: number;
    frequency: string;
    priority: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    isRecurring: boolean;
    isApproved: boolean;
  }>;
  status: string;
  createdAt: string;
}

interface ZeroBudgetPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  items: ZeroBudgetItem[];
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}

export default function ZeroBasedBudgeting(): React.JSX.Element {
  const [periods, setPeriods] = useState<ZeroBudgetPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<ZeroBudgetPeriod | null>(null);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ZeroBudgetItem | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  // Load periods from localStorage
  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = () => {
    const stored = localStorage.getItem('wealthtracker_zbb_periods');
    if (stored) {
      const parsed = JSON.parse(stored);
      const periods = parsed.map((p: SavedZeroBudgetPeriod) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        createdAt: new Date(p.createdAt),
        items: p.items.map((item) => ({
          ...item,
          ...item,
          frequency: item.frequency as ZeroBudgetItem['frequency'],
          priority: item.priority as ZeroBudgetItem['priority'],
          startDate: item.startDate ? new Date(item.startDate) : undefined,
          endDate: item.endDate ? new Date(item.endDate) : undefined
        }))
      }));
      setPeriods(periods);
      
      // Set active period
      const active = periods.find((p: ZeroBudgetPeriod) => p.status === 'active');
      setActivePeriod(active || null);
    }
  };

  const savePeriods = (newPeriods: ZeroBudgetPeriod[]) => {
    localStorage.setItem('wealthtracker_zbb_periods', JSON.stringify(newPeriods));
    setPeriods(newPeriods);
  };

  const createNewPeriod = (data: Partial<ZeroBudgetPeriod>) => {
    const newPeriod: ZeroBudgetPeriod = {
      id: `period-${Date.now()}`,
      name: data.name || 'New Budget Period',
      startDate: data.startDate || new Date(),
      endDate: data.endDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
      totalIncome: data.totalIncome || 0,
      items: [],
      status: 'draft',
      createdAt: new Date()
    };

    // Copy items from previous period if requested
    if (activePeriod && confirm('Copy items from the current period?')) {
      newPeriod.items = activePeriod.items.map(item => ({
        ...item,
        id: `item-${Date.now()}-${Math.random()}`,
        isApproved: false
      }));
    }

    const updatedPeriods = [...periods, newPeriod];
    savePeriods(updatedPeriods);
    setActivePeriod(newPeriod);
    setShowNewPeriodModal(false);
  };

  const updatePeriod = (periodId: string, updates: Partial<ZeroBudgetPeriod>) => {
    const updatedPeriods = periods.map(p => 
      p.id === periodId ? { ...p, ...updates } : p
    );
    savePeriods(updatedPeriods);
    
    if (activePeriod?.id === periodId) {
      setActivePeriod({ ...activePeriod, ...updates });
    }
  };

  const addOrUpdateItem = (item: ZeroBudgetItem) => {
    if (!activePeriod) return;

    let updatedItems: ZeroBudgetItem[];
    
    if (editingItem) {
      updatedItems = activePeriod.items.map(i => 
        i.id === editingItem.id ? item : i
      );
    } else {
      updatedItems = [...activePeriod.items, {
        ...item,
        id: `item-${Date.now()}`
      }];
    }

    updatePeriod(activePeriod.id, { items: updatedItems });
    setShowItemModal(false);
    setEditingItem(null);
  };

  const deleteItem = (itemId: string) => {
    if (!activePeriod) return;
    
    const updatedItems = activePeriod.items.filter(i => i.id !== itemId);
    updatePeriod(activePeriod.id, { items: updatedItems });
  };

  const toggleItemApproval = (itemId: string) => {
    if (!activePeriod) return;
    
    const updatedItems = activePeriod.items.map(i => 
      i.id === itemId ? { ...i, isApproved: !i.isApproved } : i
    );
    updatePeriod(activePeriod.id, { items: updatedItems });
  };

  const activatePeriod = (periodId: string) => {
    const updatedPeriods = periods.map(p => ({
      ...p,
      status: p.id === periodId ? 'active' : p.status === 'active' ? 'completed' : p.status
    })) as ZeroBudgetPeriod[];
    
    savePeriods(updatedPeriods);
    const newActive = updatedPeriods.find(p => p.id === periodId);
    setActivePeriod(newActive || null);
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!activePeriod) return { allocated: 0, approved: 0, remaining: 0 };

    const allocated = activePeriod.items.reduce((sum, item) => {
      let amount = item.amount;
      
      // Adjust for frequency
      switch (item.frequency) {
        case 'weekly':
          amount = amount * 4.33; // Average weeks per month
          break;
        case 'quarterly':
          amount = amount / 3;
          break;
        case 'annual':
          amount = amount / 12;
          break;
      }
      
      return sum + amount;
    }, 0);

    const approved = activePeriod.items
      .filter(i => i.isApproved)
      .reduce((sum, item) => {
        let amount = item.amount;
        switch (item.frequency) {
          case 'weekly':
            amount = amount * 4.33;
            break;
          case 'quarterly':
            amount = amount / 3;
            break;
          case 'annual':
            amount = amount / 12;
            break;
        }
        return sum + amount;
      }, 0);

    const remaining = activePeriod.totalIncome - allocated;

    return { allocated, approved, remaining };
  };

  const totals = calculateTotals();

  // Filter items
  const filteredItems = activePeriod?.items.filter(item => {
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    return true;
  }) || [];

  // Get unique categories from items
  const itemCategories = Array.from(new Set(activePeriod?.items.map(i => i.category) || []));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Zero-Based Budgeting</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Build your budget from scratch, justifying every expense
          </p>
        </div>
        
        <button
          onClick={() => setShowNewPeriodModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon size={20} />
          New Budget Period
        </button>
      </div>

      {/* Period Selector */}
      {periods.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Budget Period</label>
            <select
              value={activePeriod?.id || ''}
              onChange={(e) => {
                const period = periods.find(p => p.id === e.target.value);
                setActivePeriod(period || null);
              }}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.name} ({period.status})
                </option>
              ))}
            </select>
          </div>
          
          {activePeriod && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {activePeriod.startDate.toLocaleDateString()} - {activePeriod.endDate.toLocaleDateString()}
              </span>
              {activePeriod.status === 'draft' && (
                <button
                  onClick={() => activatePeriod(activePeriod.id)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Activate Period
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activePeriod ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold">{formatCurrency(activePeriod.totalIncome)}</p>
                </div>
                <TrendingUpIcon size={32} className="text-green-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Allocated</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.allocated)}</p>
                  <p className="text-xs text-gray-500">{((totals.allocated / activePeriod.totalIncome) * 100).toFixed(1)}%</p>
                </div>
                <CalculatorIcon size={32} className="text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.approved)}</p>
                  <p className="text-xs text-gray-500">{((totals.approved / activePeriod.totalIncome) * 100).toFixed(1)}%</p>
                </div>
                <CheckCircleIcon size={32} className="text-green-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
                  <p className={`text-2xl font-bold ${totals.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totals.remaining)}
                  </p>
                </div>
                {totals.remaining < 0 ? (
                  <AlertCircleIcon size={32} className="text-red-600" />
                ) : (
                  <CheckCircleIcon size={32} className="text-green-600" />
                )}
              </div>
            </div>
          </div>

          {/* Filters and Add Button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="all">All Priorities</option>
                <option value="essential">Essential</option>
                <option value="important">Important</option>
                <option value="nice-to-have">Nice to Have</option>
              </select>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="all">All Categories</option>
                {itemCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowItemModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <PlusIcon size={20} />
              Add Budget Item
            </button>
          </div>

          {/* Budget Items */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Budget Items</h3>
            
            {filteredItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No budget items yet. Start by adding your essential expenses.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      item.isApproved 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={item.isApproved}
                        onChange={() => toggleItemApproval(item.id)}
                        className="mt-1 rounded"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.description}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.priority === 'essential' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            item.priority === 'important' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                          }`}>
                            {item.priority}
                          </span>
                          {item.isRecurring && (
                            <RefreshCwIcon size={14} className="text-gray-500" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {item.category} {item.subcategory && `• ${item.subcategory}`} • {item.frequency}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        {formatCurrency(item.amount)}
                        {item.frequency !== 'monthly' && (
                          <span className="text-xs text-gray-500">/{item.frequency}</span>
                        )}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowItemModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                        >
                          <EditIcon size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                        >
                          <DeleteIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <InfoIcon size={24} className="text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Zero-Based Budgeting Tips
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <li>• Start with essential expenses: housing, utilities, food, transportation</li>
                  <li>• Add important items: insurance, debt payments, savings</li>
                  <li>• Consider nice-to-have items only after essentials are covered</li>
                  <li>• Every dollar should have a purpose - aim for zero remaining</li>
                  <li>• Review and adjust regularly as priorities change</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <CalculatorIcon size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Get Started with Zero-Based Budgeting</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first budget period to start allocating every dollar
          </p>
          <button
            onClick={() => setShowNewPeriodModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Budget Period
          </button>
        </div>
      )}

      {/* New Period Modal */}
      {showNewPeriodModal && (
        <NewPeriodModal
          onSave={createNewPeriod}
          onClose={() => setShowNewPeriodModal(false)}
        />
      )}

      {/* Budget Item Modal */}
      {showItemModal && (
        <BudgetItemModal
          item={editingItem}
          categories={categories}
          onSave={addOrUpdateItem}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

// New Period Modal
interface NewPeriodModalProps {
  onSave: (data: Partial<ZeroBudgetPeriod>) => void;
  onClose: () => void;
}

function NewPeriodModal({ onSave, onClose }: NewPeriodModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    totalIncome: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen onClose={onClose} title="New Budget Period">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Period Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="e.g., January 2024 Budget"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate.toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Total Expected Income</label>
              <input
                type="number"
                step="0.01"
                value={formData.totalIncome}
                onChange={(e) => setFormData({ ...formData, totalIncome: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="0.00"
                required
              />
            </div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Period
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// Budget Item Modal
interface BudgetItemModalProps {
  item: ZeroBudgetItem | null;
  categories: Category[];
  onSave: (item: ZeroBudgetItem) => void;
  onClose: () => void;
}

function BudgetItemModal({ item, categories, onSave, onClose }: BudgetItemModalProps) {
  const [formData, setFormData] = useState<Partial<ZeroBudgetItem>>(
    item || {
      category: '',
      description: '',
      amount: 0,
      frequency: 'monthly',
      priority: 'important',
      isRecurring: false,
      isApproved: false,
      notes: ''
    }
  );

  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ZeroBudgetItem);
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edit Budget Item' : 'Add Budget Item'}>
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="e.g., Monthly rent payment"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as ZeroBudgetItem['frequency'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="once">One-time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as ZeroBudgetItem['priority'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="essential">Essential</option>
                  <option value="important">Important</option>
                  <option value="nice-to-have">Nice to Have</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                rows={2}
                placeholder="Additional notes or justification"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Recurring expense</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isApproved}
                  onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Pre-approved</span>
              </label>
            </div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {item ? 'Update' : 'Add'} Item
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
