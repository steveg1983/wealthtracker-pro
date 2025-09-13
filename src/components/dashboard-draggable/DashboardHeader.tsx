import React, { useEffect, memo } from 'react';
import { PencilIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { logger } from '../../services/loggingService';

interface DashboardHeaderProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

const DashboardHeader = memo(function DashboardHeader({
  isEditMode,
  onToggleEditMode
}: DashboardHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardHeader component initialized', {
      componentName: 'DashboardHeader'
    });
  }, []);

  return (
    <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow-lg mb-6">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <button
            onClick={onToggleEditMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-gray-700 hover:text-gray-900"
            style={{
              backgroundColor: isEditMode ? '#C5D3E8' : '#D9E1F2',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C5D3E8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isEditMode ? '#C5D3E8' : '#D9E1F2'}
          >
            {isEditMode ? (
              <>
                <LockClosedIcon className="w-4 h-4" />
                Save Layout
              </>
            ) : (
              <>
                <PencilIcon className="w-4 h-4" />
                Edit Layout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default DashboardHeader;