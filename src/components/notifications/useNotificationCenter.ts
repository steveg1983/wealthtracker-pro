import { useState, useMemo, useCallback } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { notificationService } from '../../services/notificationService';
import type { Notification, NotificationRule, TabType, FilterType } from './types';

export function useNotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [rules, setRules] = useState<NotificationRule[]>(notificationService.getRules());

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'unread') {
        filtered = filtered.filter(n => !n.read);
      } else {
        filtered = filtered.filter(n => n.type === filter);
      }
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, filter, searchTerm]);

  const handleToggleRule = (ruleId: string, enabled: boolean): void => {
    notificationService.updateRule(ruleId, { enabled });
    setRules(notificationService.getRules());
  };

  const handleDeleteRule = (ruleId: string): void => {
    if (confirm('Are you sure you want to delete this notification rule?')) {
      notificationService.deleteRule(ruleId);
      setRules(notificationService.getRules());
    }
  };

  const handleEditRule = (rule: NotificationRule): void => {
    setEditingRule(rule);
    setShowRuleEditor(true);
  };

  const handleCreateRule = (): void => {
    setEditingRule(null);
    setShowRuleEditor(true);
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return {
    // State
    notifications,
    unreadCount,
    activeTab,
    filter,
    searchTerm,
    showRuleEditor,
    editingRule,
    rules,
    filteredNotifications,
    
    // Actions
    setActiveTab,
    setFilter,
    setSearchTerm,
    setShowRuleEditor,
    setEditingRule,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    handleToggleRule,
    handleDeleteRule,
    handleEditRule,
    handleCreateRule,
    formatTime
  };
}