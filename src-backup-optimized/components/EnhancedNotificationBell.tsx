import React, { useState, useEffect } from 'react';
import { 
  BellIcon as Bell,
  TrendingUpIcon as TrendingUp,
  CreditCardIcon as CreditCard,
  TargetIcon as Target,
  PiggyBankIcon as PiggyBank,
  AlertCircleIcon as AlertCircle,
  CheckCircleIcon as CheckCircle,
  InfoIcon as Info,
  DollarSignIcon as DollarSign,
  ClockIcon as Clock,
  XIcon as X
} from './icons';
import { useActivityTracking, ActivityItem } from '../hooks/useActivityTracking';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ActivityGroup {
  date: string;
  items: ActivityItem[];
}

export default function EnhancedNotificationBell(): React.JSX.Element {
  const navigate = useNavigate();
  const {
    activities,
    counts,
    markAsRead,
    markAllAsRead,
    clearActivities,
    getNewSinceLastCheck
  } = useActivityTracking();
  
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityItem['type'] | 'all'>('all');
  const [showPulse, setShowPulse] = useState(false);

  // Show pulse animation for new activities
  useEffect(() => {
    const newActivities = getNewSinceLastCheck();
    if (newActivities.length > 0) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 3000);
    }
  }, [activities]);

  const getFilteredActivities = (): ActivityItem[] => {
    // Filter out sync and system notifications - only show app-data notifications
    const appActivities = activities.filter(a => a.type !== 'sync' && a.type !== 'system');
    if (filter === 'all') return appActivities;
    return appActivities.filter(a => a.type === filter);
  };

  const groupActivitiesByDate = (): ActivityGroup[] => {
    const filtered = getFilteredActivities();
    const groups = new Map<string, ActivityItem[]>();
    
    filtered.forEach(activity => {
      const date = getDateGroup(activity.timestamp);
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(activity);
    });

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items
    }));
  };

  const getDateGroup = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      return 'This Week';
    } else {
      return 'Earlier';
    }
  };

  const getActivityIcon = (activity: ActivityItem): React.JSX.Element => {
    switch (activity.type) {
      case 'transaction':
        return <CreditCard size={16} className="text-gray-500" />;
      case 'account':
        return <PiggyBank size={16} className="text-green-500" />;
      case 'budget':
        return <Target size={16} className="text-purple-500" />;
      case 'goal':
        return <TrendingUp size={16} className="text-orange-500" />;
      case 'sync':
        return <CheckCircle size={16} className="text-teal-500" />;
      case 'system':
        return <Info size={16} className="text-gray-500" />;
      default:
        return <Bell size={16} className="text-gray-500" />;
    }
  };

  const getActivityColor = (activity: ActivityItem): string => {
    if (!activity.read) return 'bg-blue-50 dark:bg-gray-900/20 border-blue-200 dark:border-blue-800';
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  const handleActivityClick = (activity: ActivityItem) => {
    markAsRead(activity.id);
    if (activity.actionUrl) {
      navigate(activity.actionUrl);
      setIsOpen(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      clearActivities();
    }
  };

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label={`Notifications${counts.unread > 0 ? ` (${counts.unread} unread)` : ''}`}
      >
        <Bell size={20} className="text-gray-700 dark:text-gray-200" />
        
        {/* Unread Badge */}
        {counts.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {counts.unread > 99 ? '99+' : counts.unread}
          </span>
        )}

        {/* Pulse Animation for New Activities */}
        {showPulse && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping"></span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {counts.unread > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-gray-600 dark:text-gray-500 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 mt-3 overflow-x-auto">
                {[
                  { value: 'all', label: 'All', count: counts.total },
                  { value: 'transaction', label: 'Transactions', count: counts.transactions },
                  { value: 'account', label: 'Accounts', count: counts.accounts },
                  { value: 'budget', label: 'Budgets', count: counts.budgets },
                  { value: 'system', label: 'System', count: counts.system }
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value as any)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
                      filter === tab.value
                        ? 'bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1 text-xs opacity-70">({tab.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity List */}
            <div className="overflow-y-auto" style={{ maxHeight: '450px' }}>
              {getFilteredActivities().length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No notifications
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Your recent activity will appear here
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {groupActivitiesByDate().map(group => (
                    <div key={group.date} className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">
                        {group.date}
                      </h4>
                      
                      <div className="space-y-1">
                        {group.items.map(activity => (
                          <button
                            key={activity.id}
                            onClick={() => handleActivityClick(activity)}
                            className={`w-full p-3 rounded-lg border transition-all hover:shadow-sm text-left ${getActivityColor(activity)}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getActivityIcon(activity)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium text-gray-900 dark:text-white ${!activity.read ? 'font-semibold' : ''}`}>
                                  {activity.title}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                                  {activity.description}
                                </p>
                                {activity.amount && (
                                  <p className={`text-sm font-medium mt-1 ${
                                    activity.amount > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    £{Math.abs(activity.amount).toFixed(2)}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                </p>
                              </div>

                              {!activity.read && (
                                <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {getFilteredActivities().length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleClearAll}
                  className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
