/**
 * Custom Hook for Subscription Manager
 * Manages subscription state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { subscriptionManagerService, type FilterOption, type SortOption } from '../services/subscriptionManagerService';
import type { Subscription } from '../services/dataIntelligenceService';

export interface UseSubscriptionManagerReturn {
  subscriptions: Subscription[];
  isLoading: boolean;
  showAddModal: boolean;
  editingSubscription: Subscription | null;
  filter: FilterOption;
  sortBy: SortOption;
  stats: {
    activeCount: number;
    monthlyCost: number;
    dueSoonCount: number;
    cancelledCount: number;
  };
  filteredSubscriptions: Subscription[];
  setShowAddModal: (show: boolean) => void;
  setEditingSubscription: (subscription: Subscription | null) => void;
  setFilter: (filter: FilterOption) => void;
  setSortBy: (sortBy: SortOption) => void;
  handleAddSubscription: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>) => void;
  handleUpdateSubscription: (id: string, updates: Partial<Subscription>) => void;
  handleDeleteSubscription: (id: string) => void;
  loadSubscriptions: () => void;
}

export function useSubscriptionManager(
  onDataChange?: () => void
): UseSubscriptionManagerReturn {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('nextPayment');

  const loadSubscriptions = useCallback(() => {
    setIsLoading(true);
    const subs = subscriptionManagerService.loadSubscriptions();
    setSubscriptions(subs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleAddSubscription = useCallback((
    newSub: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>
  ) => {
    subscriptionManagerService.addSubscription(newSub);
    loadSubscriptions();
    onDataChange?.();
    setShowAddModal(false);
  }, [loadSubscriptions, onDataChange]);

  const handleUpdateSubscription = useCallback((
    id: string,
    updates: Partial<Subscription>
  ) => {
    subscriptionManagerService.updateSubscription(id, updates);
    loadSubscriptions();
    onDataChange?.();
    setEditingSubscription(null);
  }, [loadSubscriptions, onDataChange]);

  const handleDeleteSubscription = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this subscription?')) {
      subscriptionManagerService.deleteSubscription(id);
      loadSubscriptions();
      onDataChange?.();
    }
  }, [loadSubscriptions, onDataChange]);

  const filteredSubscriptions = subscriptionManagerService.filterAndSortSubscriptions(
    subscriptions,
    filter,
    sortBy
  );

  const stats = subscriptionManagerService.calculateStats(subscriptions);

  return {
    subscriptions,
    isLoading,
    showAddModal,
    editingSubscription,
    filter,
    sortBy,
    stats,
    filteredSubscriptions,
    setShowAddModal,
    setEditingSubscription,
    setFilter,
    setSortBy,
    handleAddSubscription,
    handleUpdateSubscription,
    handleDeleteSubscription,
    loadSubscriptions
  };
}