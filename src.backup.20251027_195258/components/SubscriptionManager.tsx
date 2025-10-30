import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import type { Subscription } from '../services/dataIntelligenceService';
import { logger } from '../services/loggingService';
import {
  CreditCardIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CalendarIcon,
  DollarSignIcon,
  StopIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  ClockIcon
} from './icons';

interface SubscriptionManagerProps {
  onDataChange?: () => void;
}

export default function SubscriptionManager({ onDataChange }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled' | 'trial'>('all');
  const [sortBy, setSortBy] = useState<'nextPayment' | 'amount' | 'merchant'>('nextPayment');

  const loadSubscriptions = useCallback(() => {
    setIsLoading(true);
    try {
      const subs = dataIntelligenceService.getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      logger.error('Error loading subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleDeleteSubscription = (id: string) => {
    if (confirm('Are you sure you want to delete this subscription?')) {
      dataIntelligenceService.deleteSubscription(id);
      loadSubscriptions();
      onDataChange?.();
    }
  };

  const getStatusIcon = (status: Subscription['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon size={16} className="text-green-500" />;
      case 'cancelled':
        return <XCircleIcon size={16} className="text-red-500" />;
      case 'paused':
        return <StopIcon size={16} className="text-yellow-500" />;
      case 'trial':
        return <ClockIcon size={16} className="text-gray-500" />;
      default:
        return <AlertCircleIcon size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: Subscription['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'trial':
        return 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getDaysUntilRenewal = (date: Date) => {
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter(sub => filter === 'all' || sub.status === filter)
      .sort((a, b) => {
        switch (sortBy) {
          case 'nextPayment':
            return a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime();
          case 'amount':
            return b.amount - a.amount;
          case 'merchant':
            return a.merchantName.localeCompare(b.merchantName);
          default:
            return 0;
        }
      });
  }, [subscriptions, filter, sortBy]);

  const totalMonthlyAmount = useMemo(() => {
    return subscriptions
      .filter(sub => sub.status === 'active')
      .reduce((sum, sub) => {
        const monthlyAmount = sub.frequency === 'monthly' ? sub.amount :
                             sub.frequency === 'yearly' ? sub.amount / 12 :
                             sub.frequency === 'quarterly' ? sub.amount / 3 :
                             sub.frequency === 'weekly' ? sub.amount * 4.33 : sub.amount;
        return sum + monthlyAmount;
      }, 0);
  }, [subscriptions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCwIcon size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCardIcon size={20} className="text-green-600 dark:text-green-400" />
            Subscription Manager
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage and track your recurring subscriptions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Subscription
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {subscriptions.filter(s => s.status === 'active').length}
              </p>
            </div>
            <CheckCircleIcon size={24} className="text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Cost</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                {formatCurrency(totalMonthlyAmount)}
              </p>
            </div>
            <DollarSignIcon size={24} className="text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Due Soon</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {subscriptions.filter(s => s.status === 'active' && getDaysUntilRenewal(s.nextPaymentDate) <= 7).length}
              </p>
            </div>
            <CalendarIcon size={24} className="text-orange-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cancelled</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {subscriptions.filter(s => s.status === 'cancelled').length}
              </p>
            </div>
            <XCircleIcon size={24} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-select" className="text-sm text-gray-600 dark:text-gray-400">Filter:</label>
          <select
            id="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'cancelled' | 'trial')}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Filter subscriptions by status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'nextPayment' | 'amount' | 'merchant')}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Sort subscriptions by"
          >
            <option value="nextPayment">Next Payment</option>
            <option value="amount">Amount</option>
            <option value="merchant">Merchant</option>
          </select>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-8">
            <CreditCardIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No subscriptions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Subscriptions table">
            <table className="w-full" role="table" aria-label="Active subscriptions">
              <caption className="sr-only">List of active subscriptions with payment details and status</caption>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr role="row">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    Merchant
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    Frequency
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    Next Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" role="columnheader">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSubscriptions.map((subscription) => {
                  const daysUntilRenewal = getDaysUntilRenewal(subscription.nextPaymentDate);
                  const isUpcoming = daysUntilRenewal <= 7 && daysUntilRenewal > 0;
                  const isOverdue = daysUntilRenewal < 0;

                  return (
                    <tr key={subscription.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50" role="row">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {subscription.merchantName}
                          </div>
                          {subscription.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {subscription.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 dark:text-white font-medium">
                          {formatCurrency(subscription.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 dark:text-white capitalize">
                          {subscription.frequency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          isOverdue ? 'text-red-600 dark:text-red-400' :
                          isUpcoming ? 'text-orange-600 dark:text-orange-400' :
                          'text-gray-900 dark:text-white'
                        }`}>
                          {formatDate(subscription.nextPaymentDate)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {isOverdue ? `${Math.abs(daysUntilRenewal)} days overdue` :
                           daysUntilRenewal === 0 ? 'Due today' :
                           `${daysUntilRenewal} days`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                          {getStatusIcon(subscription.status)}
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingSubscription(subscription)}
                            className="text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubscription(subscription.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal would go here - simplified for this implementation */}
      {(showAddModal || editingSubscription) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Subscription management modal would be implemented here.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSubscription(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
