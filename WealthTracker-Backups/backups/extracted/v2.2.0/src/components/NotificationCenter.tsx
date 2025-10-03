import { useState, useMemo, useCallback } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification } from '../contexts/NotificationContext';
import { notificationService } from '../services/notificationService';
import type { NotificationRule, NotificationCondition, NotificationAction } from '../services/notificationService';
import { VirtualizedList } from './VirtualizedList';
import {
  BellIcon,
  BellOffIcon,
  SettingsIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  InfoIcon,
  CheckCircleIcon,
  XCircleIcon,
  FilterIcon,
  SearchIcon,
  TrendingUpIcon,
  DollarSignIcon,
  TargetIcon,
  CreditCardIcon,
  CalendarIcon,
  PlayIcon,
  StopIcon,
  RefreshCwIcon
} from './icons';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps): React.JSX.Element | null {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<'notifications' | 'rules' | 'settings'>('notifications');
  const [filter, setFilter] = useState<'all' | 'unread' | 'success' | 'warning' | 'error'>('all');
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

  const getIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'success': return <CheckCircleIcon size={16} className="text-green-600" />;
      case 'warning': return <AlertCircleIcon size={16} className="text-yellow-600" />;
      case 'error': return <XCircleIcon size={16} className="text-red-600" />;
      default: return <InfoIcon size={16} className="text-gray-600" />;
    }
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

  const getRuleTypeIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'budget': return <DollarSignIcon size={16} className="text-green-600" />;
      case 'transaction': return <CreditCardIcon size={16} className="text-gray-600" />;
      case 'goal': return <TargetIcon size={16} className="text-purple-600" />;
      case 'account': return <TrendingUpIcon size={16} className="text-orange-600" />;
      default: return <BellIcon size={16} className="text-gray-600" />;
    }
  };

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

  // Render notification item for VirtualizedList
  const renderNotification = useCallback((notification: Notification, index: number, style: React.CSSProperties): React.ReactNode => {
    return (
      <div
        style={style}
        className={`p-4 rounded-lg border transition-all hover:shadow-md ${
          !notification.read
            ? 'bg-blue-50 dark:bg-gray-900/20 border-blue-200 dark:border-blue-700'
            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getIcon(notification.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={`font-medium text-sm text-gray-900 dark:text-white ${
                  !notification.read ? 'font-semibold' : ''
                }`}>
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {notification.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  {formatTime(notification.timestamp)}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {notification.action && (
                <button
                  onClick={() => {
                    markAsRead(notification.id);
                    notification.action!.onClick();
                  }}
                  className="text-xs text-gray-600 hover:text-blue-700 font-medium"
                >
                  {notification.action.label}
                </button>
              )}
              {!notification.read && (
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Mark as read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [removeNotification, markAsRead, getIcon, formatTime]);

  // Render rule item for VirtualizedList
  const renderRule = useCallback((rule: NotificationRule, index: number, style: React.CSSProperties): React.ReactNode => {
    return (
      <div
        style={style}
        className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1">{getRuleTypeIcon(rule.type)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {rule.name}
                </h4>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  rule.enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                }`}>
                  {rule.enabled ? 'Active' : 'Inactive'}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  rule.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                  rule.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                  rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                  'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-gray-500'
                }`}>
                  {rule.priority}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {rule.conditions.map(c => c.description).join(', ')}
              </p>
              {rule.lastTriggered && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Last triggered: {formatTime(rule.lastTriggered)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleRule(rule.id, !rule.enabled)}
              className={`p-2 rounded-lg ${
                rule.enabled
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title={rule.enabled ? 'Disable rule' : 'Enable rule'}
            >
              {rule.enabled ? <PlayIcon size={16} /> : <StopIcon size={16} />}
            </button>
            <button
              onClick={() => handleEditRule(rule)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg"
              title="Edit rule"
            >
              <EditIcon size={16} />
            </button>
            <button
              onClick={() => handleDeleteRule(rule.id)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              title="Delete rule"
            >
              <DeleteIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }, [getRuleTypeIcon, formatTime, handleToggleRule, handleEditRule, handleDeleteRule]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BellIcon size={24} className="text-gray-600 dark:text-gray-500" />
              Notification Center
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mt-4">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <BellIcon size={16} />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'rules'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <SettingsIcon size={16} />
              Rules ({rules.filter(r => r.enabled).length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <SettingsIcon size={16} />
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'notifications' && (
            <div className="p-6">
              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FilterIcon size={16} className="text-gray-500" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'success' | 'warning' | 'error')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="success">Success</option>
                    <option value="warning">Warnings</option>
                    <option value="error">Errors</option>
                  </select>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-4 py-2 text-gray-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Mark All Read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Notifications List */}
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <BellOffIcon size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {filter === 'all' && !searchTerm
                      ? 'No notifications yet'
                      : 'No notifications found'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {filter === 'all' && !searchTerm
                      ? 'New notifications will appear here'
                      : 'Try adjusting your filters or search terms'}
                  </p>
                </div>
              ) : (
                <div style={{ height: 'calc(100vh - 400px)', minHeight: '300px' }}>
                  <VirtualizedList
                    items={filteredNotifications}
                    renderItem={(item, index, style) => renderNotification(item as Notification, index, style)}
                    getItemKey={(item) => (item as Notification).id}
                    itemHeight={120}
                    className="space-y-3"
                    threshold={20}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="p-6">
              {/* Rules Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notification Rules
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure when and how you receive notifications
                  </p>
                </div>
                <button
                  onClick={handleCreateRule}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <PlusIcon size={16} />
                  Add Rule
                </button>
              </div>

              {/* Rules List */}
              {rules.length === 0 ? (
                <div className="text-center py-12">
                  <SettingsIcon size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No notification rules
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Create rules to customize when and how you receive notifications
                  </p>
                  <button
                    onClick={handleCreateRule}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Create Your First Rule
                  </button>
                </div>
              ) : (
                <div style={{ height: 'calc(100vh - 400px)', minHeight: '300px' }}>
                  <VirtualizedList
                    items={rules}
                    renderItem={(item, index, style) => renderRule(item as NotificationRule, index, style)}
                    getItemKey={(item) => (item as NotificationRule).id}
                    itemHeight={100}
                    className="space-y-3"
                    threshold={20}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Notification Settings
              </h3>
              
              {/* Global Settings */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Budget Alerts
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Warning threshold (% of budget)
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={notificationService.getBudgetConfig().warningThreshold}
                        onChange={(e) => {
                          notificationService.updateBudgetConfig({
                            warningThreshold: parseInt(e.target.value) || 80
                          });
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Danger threshold (% of budget)
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={notificationService.getBudgetConfig().dangerThreshold}
                        onChange={(e) => {
                          notificationService.updateBudgetConfig({
                            dangerThreshold: parseInt(e.target.value) || 100
                          });
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Transaction Alerts
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Large transaction threshold (£)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={notificationService.getTransactionConfig().largeTransactionThreshold}
                        onChange={(e) => {
                          notificationService.updateTransactionConfig({
                            largeTransactionThreshold: parseInt(e.target.value) || 500
                          });
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Duplicate detection
                      </span>
                      <button
                        onClick={() => {
                          const config = notificationService.getTransactionConfig();
                          notificationService.updateTransactionConfig({
                            duplicateDetectionEnabled: !config.duplicateDetectionEnabled
                          });
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          notificationService.getTransactionConfig().duplicateDetectionEnabled
                            ? 'bg-gray-600'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            notificationService.getTransactionConfig().duplicateDetectionEnabled
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Goal Celebrations
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Milestone notifications
                      </span>
                      <button
                        onClick={() => {
                          const config = notificationService.getGoalConfig();
                          notificationService.updateGoalConfig({
                            enableMilestoneNotifications: !config.enableMilestoneNotifications
                          });
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          notificationService.getGoalConfig().enableMilestoneNotifications
                            ? 'bg-gray-600'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            notificationService.getGoalConfig().enableMilestoneNotifications
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Completion celebrations
                      </span>
                      <button
                        onClick={() => {
                          const config = notificationService.getGoalConfig();
                          notificationService.updateGoalConfig({
                            enableCompletionCelebration: !config.enableCompletionCelebration
                          });
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          notificationService.getGoalConfig().enableCompletionCelebration
                            ? 'bg-gray-600'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            notificationService.getGoalConfig().enableCompletionCelebration
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredNotifications.length} of {notifications.length} notifications
              {unreadCount > 0 && ` • ${unreadCount} unread`}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}