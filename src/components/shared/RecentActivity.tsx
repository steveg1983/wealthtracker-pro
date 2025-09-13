import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { ClockIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface Activity {
  id: string;
  memberName: string;
  details: string;
  timestamp: Date;
}

interface RecentActivityProps {
  activities: Activity[];
}

export const RecentActivity = memo(function RecentActivity({ 
  activities 
}: RecentActivityProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RecentActivity component initialized', {
      componentName: 'RecentActivity'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.slice(0, 5).map(activity => (
          <div key={activity.id} className="flex items-start gap-3 text-sm">
            <ClockIcon size={16} className="text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p>
                <span className="font-medium">{activity.memberName}</span>
                {' '}
                <span className="text-gray-600 dark:text-gray-400">{activity.details}</span>
              </p>
              <p className="text-xs text-gray-500">
                {format(activity.timestamp, 'MMM d, h:mm a')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});