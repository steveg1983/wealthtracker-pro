/**
 * Info Card Component
 * Reusable card for displaying financial information
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface InfoCardProps {
  title: string;
  colorScheme: 'blue' | 'green' | 'purple' | 'gray' | 'amber';
  children: React.ReactNode;
}

const colorClasses = {
  blue: 'bg-blue-50 dark:bg-gray-900/20 text-blue-900 dark:text-blue-100',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100',
  gray: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800'
};

const InfoCard = React.memo(({ title, colorScheme, children }: InfoCardProps) => {
  return (
    <div className={`rounded-lg p-4 ${colorClasses[colorScheme]}`}>
      <h4 className="font-medium mb-3">{title}</h4>
      {children}
    </div>
  );
});

InfoCard.displayName = 'InfoCard';

export default InfoCard;