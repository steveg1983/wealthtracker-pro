import React, { useEffect, memo } from 'react';
import { BellIcon, InfoIcon, AlertCircleIcon } from '../icons';
import type { AlertStats } from './types';
import { logger } from '../../services/loggingService';

interface AlertStatsProps {
  stats: AlertStats;
}

export const AlertStatsComponent = memo(function AlertStatsComponent({ stats }: AlertStatsProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BellIcon size={16} className="text-gray-500" />}
          label="Total Alerts"
          value={stats.totalAlerts}
          bgColor="bg-gray-50 dark:bg-gray-700/50"
        />
        
        <StatCard
          icon={<InfoIcon size={16} className="text-amber-600 dark:text-amber-400" />}
          label="Unread"
          value={stats.unreadAlerts}
          bgColor="bg-amber-50 dark:bg-amber-900/20"
          borderColor="border-l-4 border-amber-400 dark:border-amber-600"
        />
        
        <StatCard
          icon={<AlertCircleIcon size={16} className="text-yellow-500" />}
          label="Warnings"
          value={stats.warningAlerts}
          bgColor="bg-yellow-50 dark:bg-yellow-900/20"
          textColor="text-yellow-700 dark:text-yellow-300"
          valueColor="text-yellow-900 dark:text-yellow-100"
        />
        
        <StatCard
          icon={<AlertCircleIcon size={16} className="text-red-500" />}
          label="Critical"
          value={stats.criticalAlerts}
          bgColor="bg-red-50 dark:bg-red-900/20"
          textColor="text-red-700 dark:text-red-300"
          valueColor="text-red-900 dark:text-red-100"
        />
      </div>

      {stats.totalAlerts > 0 && (
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            Most alerts in <strong>{stats.mostAlertedCategory}</strong> • 
            Average spending: <strong>{stats.averageSpendingPercentage.toFixed(0)}%</strong>
          </p>
        </div>
      )}
    </>
  );
});

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
  borderColor?: string;
  textColor?: string;
  valueColor?: string;
}

const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  bgColor,
  borderColor = '',
  textColor = 'text-gray-600 dark:text-gray-400',
  valueColor = 'text-gray-900 dark:text-white'
}: StatCardProps) {
  return (
    <div className={`${bgColor} rounded-lg p-3 ${borderColor} shadow-md`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-xs ${textColor}`}>{label}</span>
      </div>
      <p className={`text-xl font-semibold ${valueColor}`}>
        {value}
      </p>
    </div>
  );
});