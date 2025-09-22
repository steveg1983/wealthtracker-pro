/**
 * @component BillTabNavigation
 * @description Tab navigation component for filtering bills by status
 * @performance Memoized to prevent unnecessary re-renders
 */

import React, { memo } from 'react';

type BillTabId = 'upcoming' | 'overdue' | 'all' | 'history';

interface BillTabNavigationProps {
  activeTab: BillTabId;
  setActiveTab: (tab: BillTabId) => void;
  tabs: Array<{ id: BillTabId; label: string; count: number }>;
}

export const BillTabNavigation = memo(function BillTabNavigation({ 
  activeTab, 
  setActiveTab, 
  tabs 
}: BillTabNavigationProps) {
  return (
    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
      {tabs.map(tab => {
        try {
          if (!tab || !tab.id) {
            return null;
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => {
                try {
                  setActiveTab(tab.id);
                } catch (error) {
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-1 rounded-full text-xs ${
                  tab.id === 'overdue' 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        } catch (error) {
          return null;
        }
      }).filter(Boolean)}
    </div>
  );
});
