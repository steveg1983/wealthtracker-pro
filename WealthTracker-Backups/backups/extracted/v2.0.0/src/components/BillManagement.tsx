import React, { useState, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useApp } from '../contexts/AppContextSupabase';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { 
  PlusIcon, 
  CalendarIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  CreditCardIcon,
  BellIcon,
  XCircleIcon,
  EditIcon,
  DeleteIcon,
  ClockIcon,
  RepeatIcon,
  DollarSignIcon,
  InfoIcon
} from './icons';

export interface Bill {
  id: string;
  name: string;
  amount: DecimalInstance;
  dueDate: Date;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  category: string;
  accountId: string;
  isAutoPay: boolean;
  isActive: boolean;
  reminderDays: number;
  notes?: string;
  paymentHistory: BillPayment[];
  createdAt: Date;
  nextDueDate: Date;
}

export interface BillPayment {
  id: string;
  billId: string;
  amount: DecimalInstance;
  paidDate: Date;
  dueDate: Date;
  isPaid: boolean;
  isLate: boolean;
  lateFee?: DecimalInstance;
  transactionId?: string;
  notes?: string;
}

export default function BillManagement() {
  const { accounts, categories, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [bills, setBills] = useLocalStorage<Bill[]>('bills', []);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'overdue' | 'all' | 'history'>('upcoming');
  
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    frequency: 'monthly' as Bill['frequency'],
    category: '',
    accountId: '',
    isAutoPay: false,
    reminderDays: 3,
    notes: ''
  });

  const calculateNextDueDate = (lastDue: Date, frequency: Bill['frequency']): Date => {
    const next = new Date(lastDue);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'one-time':
        return lastDue; // No next due date for one-time bills
    }
    
    return next;
  };

  const { upcomingBills, overdueBills, allBills } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeBills = bills.filter(bill => bill.isActive);
    
    const upcomingBills = activeBills.filter(bill => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
    
    const overdueBills = activeBills.filter(bill => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
    
    return { upcomingBills, overdueBills, allBills: activeBills };
  }, [bills]);

  const handleAddBill = () => {
    if (!newBill.name || !newBill.amount || !newBill.accountId) return;
    
    const dueDate = new Date(newBill.dueDate);
    const nextDueDate = calculateNextDueDate(dueDate, newBill.frequency);
    
    const bill: Bill = {
      id: Date.now().toString(),
      name: newBill.name,
      amount: toDecimal(parseFloat(newBill.amount)),
      dueDate: dueDate,
      frequency: newBill.frequency,
      category: newBill.category,
      accountId: newBill.accountId,
      isAutoPay: newBill.isAutoPay,
      isActive: true,
      reminderDays: newBill.reminderDays,
      notes: newBill.notes,
      paymentHistory: [],
      createdAt: new Date(),
      nextDueDate: nextDueDate
    };
    
    setBills([...bills, bill]);
    setNewBill({
      name: '',
      amount: '',
      dueDate: new Date().toISOString().split('T')[0],
      frequency: 'monthly',
      category: '',
      accountId: '',
      isAutoPay: false,
      reminderDays: 3,
      notes: ''
    });
    setShowAddBill(false);
  };

  const handlePayBill = (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const today = new Date();
    const dueDate = new Date(bill.nextDueDate);
    const isLate = today > dueDate;
    
    // Create payment record
    const payment: BillPayment = {
      id: Date.now().toString(),
      billId: billId,
      amount: bill.amount,
      paidDate: today,
      dueDate: dueDate,
      isPaid: true,
      isLate: isLate,
      lateFee: isLate ? toDecimal(25) : undefined // Default late fee
    };
    
    // Add transaction
    const transaction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: today,
      description: `Bill Payment: ${bill.name}`,
      amount: bill.amount.plus(payment.lateFee || toDecimal(0)).toNumber(),
      category: bill.category,
      accountId: bill.accountId,
      type: 'expense' as const,
      cleared: false
    };
    
    addTransaction(transaction);
    payment.transactionId = transaction.id;
    
    // Update bill
    const updatedBills = bills.map(b => {
      if (b.id === billId) {
        return {
          ...b,
          paymentHistory: [...b.paymentHistory, payment],
          nextDueDate: calculateNextDueDate(dueDate, b.frequency)
        };
      }
      return b;
    });
    
    setBills(updatedBills);
  };

  const handleDeleteBill = (billId: string) => {
    setBills(bills.filter(b => b.id !== billId));
  };

  const handleToggleActive = (billId: string) => {
    setBills(bills.map(b => 
      b.id === billId ? { ...b, isActive: !b.isActive } : b
    ));
  };

  const getDaysUntilDue = (dueDate: Date): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (bill: Bill): string => {
    const daysUntil = getDaysUntilDue(bill.nextDueDate);
    
    if (daysUntil < 0) return 'text-red-600 dark:text-red-400';
    if (daysUntil <= bill.reminderDays) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusText = (bill: Bill): string => {
    const daysUntil = getDaysUntilDue(bill.nextDueDate);
    
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `Due in ${daysUntil} days`;
  };

  const totalUpcoming = upcomingBills.reduce((sum, bill) => sum.plus(bill.amount), toDecimal(0));
  const totalOverdue = overdueBills.reduce((sum, bill) => sum.plus(bill.amount), toDecimal(0));

  const renderBillCard = (bill: Bill) => {
    const account = accounts.find(a => a.id === bill.accountId);
    const category = categories.find(c => c.id === bill.category);
    const statusColor = getStatusColor(bill);
    const statusText = getStatusText(bill);
    
    return (
      <div
        key={bill.id}
        className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 hover:shadow-xl transition-all ${
          getDaysUntilDue(bill.nextDueDate) < 0 ? 'border-red-200 dark:border-red-800' : ''
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {bill.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <DollarSignIcon size={16} />
              <span className="font-medium">{formatCurrency(bill.amount)}</span>
              {bill.isAutoPay && (
                <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                  Auto-pay
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingBill(bill)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <EditIcon size={16} />
            </button>
            <button
              onClick={() => handleToggleActive(bill.id)}
              className={`p-2 ${bill.isActive ? 'text-green-600' : 'text-gray-400'} hover:text-green-700`}
            >
              <CheckCircleIcon size={16} />
            </button>
            <button
              onClick={() => handleDeleteBill(bill.id)}
              className="p-2 text-gray-400 hover:text-red-500"
            >
              <DeleteIcon size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {bill.nextDueDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Status:</span>
            <span className={`font-medium ${statusColor}`}>
              {statusText}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Account:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {account?.name || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {bill.frequency.replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handlePayBill(bill.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <CheckCircleIcon size={16} />
            Pay Now
          </button>
          <button
            onClick={() => setSelectedBill(bill.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <InfoIcon size={16} />
            Details
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bill Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track and manage your recurring bills and payments
          </p>
        </div>
        <button
          onClick={() => setShowAddBill(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming Bills</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {upcomingBills.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(totalUpcoming)}
              </p>
            </div>
            <ClockIcon className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Bills</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overdueBills.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(totalOverdue)}
              </p>
            </div>
            <AlertCircleIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {allBills.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active bills
              </p>
            </div>
            <RepeatIcon className="text-green-500" size={24} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcomingBills.length },
          { id: 'overdue', label: 'Overdue', count: overdueBills.length },
          { id: 'all', label: 'All Bills', count: allBills.length },
          { id: 'history', label: 'History', count: 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs ${
                tab.id === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'upcoming' && upcomingBills.map(renderBillCard)}
        {activeTab === 'overdue' && overdueBills.map(renderBillCard)}
        {activeTab === 'all' && allBills.map(renderBillCard)}
        {activeTab === 'history' && (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            Payment history feature coming soon
          </div>
        )}
      </div>

      {/* Empty State */}
      {activeTab !== 'history' && (
        (activeTab === 'upcoming' && upcomingBills.length === 0) ||
        (activeTab === 'overdue' && overdueBills.length === 0) ||
        (activeTab === 'all' && allBills.length === 0)
      ) && (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No bills {activeTab === 'upcoming' ? 'upcoming' : activeTab === 'overdue' ? 'overdue' : 'found'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {activeTab === 'all' 
              ? 'Start by adding your first bill to track payments and due dates'
              : `You have no ${activeTab} bills at the moment`
            }
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => setShowAddBill(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Your First Bill
            </button>
          )}
        </div>
      )}

      {/* Add Bill Modal */}
      {showAddBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Bill</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bill Name
                </label>
                <input
                  type="text"
                  value={newBill.name}
                  onChange={(e) => setNewBill({...newBill, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Electric Bill"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={newBill.amount}
                    onChange={(e) => setNewBill({...newBill, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newBill.dueDate}
                    onChange={(e) => setNewBill({...newBill, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency
                </label>
                <select
                  value={newBill.frequency}
                  onChange={(e) => setNewBill({...newBill, frequency: e.target.value as Bill['frequency']})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account
                  </label>
                  <select
                    value={newBill.accountId}
                    onChange={(e) => setNewBill({...newBill, accountId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select account...</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={newBill.category}
                    onChange={(e) => setNewBill({...newBill, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select category...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reminder Days
                  </label>
                  <input
                    type="number"
                    value={newBill.reminderDays}
                    onChange={(e) => setNewBill({...newBill, reminderDays: parseInt(e.target.value) || 3})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    max="30"
                  />
                </div>
                <div className="flex items-center pt-8">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newBill.isAutoPay}
                      onChange={(e) => setNewBill({...newBill, isAutoPay: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-pay</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newBill.notes}
                  onChange={(e) => setNewBill({...newBill, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddBill(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBill}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}